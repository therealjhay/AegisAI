import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifyVote, quorumHash, mockTxSignature } from "@/lib/swarm";

export const dynamic = "force-dynamic";

function isVaultTableMissing(e: unknown): boolean {
  const msg = (e as Error).message ?? "";
  return msg.includes('relation "Vault_State"') || msg.includes("does not exist");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clusterId, recipientWallet } = body as { clusterId: string; recipientWallet?: string };
    if (!clusterId) return NextResponse.json({ error: "clusterId required" }, { status: 400 });

    const cres = await pool.query(`SELECT id, lat, lon, status, tier, quorum_hash FROM "Incident_Clusters" WHERE id=$1`, [clusterId]);
    if (cres.rows.length === 0) return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
    const cluster = cres.rows[0];
    if (cluster.status === "disbursed") return NextResponse.json({ error: "Cluster already disbursed", status: cluster.status }, { status: 409 });

    const vres = await pool.query(`SELECT agent_type, vote, score, signature, tool_proofs FROM "Agent_Votes" WHERE cluster_id=$1`, [clusterId]);
    if (vres.rows.length === 0) return NextResponse.json({ error: "No votes found — run /api/swarm/verify first" }, { status: 400 });

    const votes = vres.rows.map((r) => ({
      agentType: r.agent_type as string,
      vote: r.vote as string,
      score: Number(r.score),
      signature: r.signature as string,
      toolProofs: r.tool_proofs as any,
    }));

    // Verify signatures
    for (const v of votes) {
      if (!verifyVote(v.agentType, clusterId, v.vote, v.score, v.signature)) {
        return NextResponse.json({ error: `Invalid signature for ${v.agentType}` }, { status: 400 });
      }
    }
    const yesCount = votes.filter((v) => v.vote === "yes").length;
    if (yesCount < 3) return NextResponse.json({ error: `Quorum not reached: ${yesCount}/4 yes, need 3`, votes }, { status: 400 });

    const qHash = quorumHash(votes.map((v) => ({ agentType: v.agentType, vote: v.vote, signature: v.signature })));

    // Governor effective amount
    const gov = votes.find((v) => v.agentType === "risk_governor");
    const tri = votes.find((v) => v.agentType === "triage_evaluator");
    let amountUSD = (gov?.toolProofs as any)?.effective as number | undefined;
    if (!amountUSD) {
      const tier = (tri?.toolProofs as any)?.tier ?? cluster.tier ?? 2;
      const caps: Record<number, number> = { 1: 0, 2: 5000, 3: 15000, 4: 25000 };
      amountUSD = caps[tier] ?? 5000;
    }
    if (!amountUSD || amountUSD <= 0) return NextResponse.json({ error: "Governor capped amount is 0 — no disbursement" }, { status: 400 });

    // Vault checks
    let vault: { reserve_usd: number; daily_limit_usd: number; disbursed_today_usd: number } | null = null;
    try {
      const v = await pool.query(`SELECT reserve_usd, daily_limit_usd, disbursed_today_usd FROM "Vault_State" WHERE id='singleton'`);
      if (v.rows.length) vault = { reserve_usd: Number(v.rows[0].reserve_usd), daily_limit_usd: Number(v.rows[0].daily_limit_usd), disbursed_today_usd: Number(v.rows[0].disbursed_today_usd) };
    } catch (e) {
      if (!isVaultTableMissing(e)) throw e;
    }
    if (!vault) {
      await pool.query(`INSERT INTO "Vault_State" (id, reserve_usd, daily_limit_usd, disbursed_today_usd) VALUES ('singleton', 1000000, 100000, 0) ON CONFLICT (id) DO NOTHING`);
      vault = { reserve_usd: 1_000_000, daily_limit_usd: 100_000, disbursed_today_usd: 0 };
    }
    if (amountUSD > vault.daily_limit_usd - vault.disbursed_today_usd) return NextResponse.json({ error: `Daily limit exceeded: remaining $${vault.daily_limit_usd - vault.disbursed_today_usd}` }, { status: 400 });
    if (amountUSD > vault.reserve_usd) return NextResponse.json({ error: `Insufficient reserve $${vault.reserve_usd}` }, { status: 400 });
    if (amountUSD > vault.reserve_usd * 0.1) return NextResponse.json({ error: `Reserve cap: cannot disburse >10% of reserve` }, { status: 400 });

    // Recipient wallet
    let recipient = recipientWallet;
    let recipientOrg: string | null = null;
    if (!recipient) {
      const ngo = await pool.query(`SELECT organization_name, wallet_address FROM "NGO_Users" WHERE is_verified=true AND wallet_address IS NOT NULL ORDER BY id ASC LIMIT 1`);
      if (ngo.rows.length) {
        recipient = ngo.rows[0].wallet_address;
        recipientOrg = ngo.rows[0].organization_name;
      } else {
        recipient = `mockWallet_${clusterId.slice(0, 8)}_${Number(cluster.lat).toFixed(2)}_${Number(cluster.lon).toFixed(2)}`;
        recipientOrg = "Demo Responder DAO";
      }
    }

    const txSig = mockTxSignature(clusterId, qHash, amountUSD);
    const explorerUrl = `https://explorer.sonic.game/tx/${txSig}?cluster=devnet`;

    const tier = (tri?.toolProofs as any)?.tier ?? cluster.tier ?? 2;

    const disb = await pool.query(
      `INSERT INTO "Disbursement_Txs" (id, cluster_id, amount_usd, recipient_wallet, recipient_org, quorum_hash, tx_signature, explorer_url, tier, status) VALUES (gen_random_uuid(), $1,$2,$3,$4,$5,$6,$7,$8,'confirmed') RETURNING id::text as id, tx_signature, explorer_url`,
      [clusterId, amountUSD, recipient, recipientOrg, qHash, txSig, explorerUrl, tier]
    );

    await pool.query(`UPDATE "Vault_State" SET reserve_usd = reserve_usd - $1, disbursed_today_usd = disbursed_today_usd + $1 WHERE id='singleton'`, [amountUSD]);
    await pool.query(`UPDATE "Incident_Clusters" SET status='disbursed', quorum_hash=$1, tier=$2, updated_at=NOW() WHERE id=$3`, [qHash, tier, clusterId]);

    return NextResponse.json({
      disbursementId: disb.rows[0].id,
      clusterId,
      amountUSD,
      txSignature: txSig,
      explorerUrl,
      quorumHash: qHash,
      recipientWallet: recipient,
      recipientOrg,
      status: "confirmed",
    });
  } catch (e) {
    console.error("[vault/disburse] failed", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const clusterId = request.nextUrl.searchParams.get("clusterId");
  try {
    if (clusterId) {
      const r = await pool.query(`SELECT * FROM "Disbursement_Txs" WHERE cluster_id=$1 ORDER BY created_at DESC`, [clusterId]);
      return NextResponse.json({ disbursements: r.rows });
    }
    const r = await pool.query(`SELECT * FROM "Disbursement_Txs" ORDER BY created_at DESC LIMIT 50`);
    return NextResponse.json({ disbursements: r.rows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
