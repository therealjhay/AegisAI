import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { runSwarmQuorum, type SwarmInput } from "@/lib/swarm";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clusterId, raw_text, lat, lon } = body as { clusterId?: string; raw_text?: string; lat?: number; lon?: number };

    let cid = clusterId;
    let cluster: Row | null = null;

    if (cid) {
      const res = await pool.query(`SELECT id, lat, lon, "radius_m", report_count, sources, total_financial_target, status, tier FROM "Incident_Clusters" WHERE id=$1`, [cid]);
      if (res.rows.length === 0) return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
      cluster = res.rows[0];
    } else if (raw_text) {
      // ad-hoc verify without cluster: create synthetic cluster from raw_text for demo inject
      const urgency = /trapped|swept away|fatal|dead/i.test(raw_text) ? 5 : /injured|rapidly rising|spreading fast/i.test(raw_text) ? 4 : /road closed|power outage/i.test(raw_text) ? 3 : 2;
      const ll = { lat: lat ?? 11.84, lon: lon ?? 13.15 };
      const ins = await pool.query(
        `INSERT INTO "Incident_Clusters" (id, lat, lon, "radius_m", report_count, sources, status, total_financial_target, region) VALUES (gen_random_uuid(), $1,$2,120,1,'[\"demo_inject\"]'::jsonb,'pending',$3,$4) RETURNING id, lat, lon, "radius_m", report_count, sources, total_financial_target, status, tier`,
        [ll.lat, ll.lon, urgency * 4000, `${ll.lat.toFixed(2)},${ll.lon.toFixed(2)} synthetic`]
      );
      cluster = ins.rows[0] as Row;
      cid = cluster.id;
      // Also insert a shadow alert for heatmap
      await pool.query(
        `INSERT INTO "Alerts" ("raw_text","source","incident_type","coordinates","urgency_score","financial_target_usd","financial_raised_usd","source_credibility_score","verified_status","timestamp","cluster_id") VALUES ($1,'demo_inject','Natural_Disaster', ST_SetSRID(ST_MakePoint($2,$3),4326),$4,$5,0,0.85,false,NOW(),$6)`,
        [raw_text, ll.lon, ll.lat, urgency, urgency * 4000, cid]
      );
    } else {
      return NextResponse.json({ error: "Provide clusterId or raw_text" }, { status: 400 });
    }

    if (!cluster) return NextResponse.json({ error: "Cluster resolution failed" }, { status: 500 });

    // Gather raw texts + urgencies for cluster
    const alertsRes = await pool.query(`SELECT raw_text, urgency_score, source FROM "Alerts" WHERE cluster_id=$1 ORDER BY timestamp DESC LIMIT 10`, [cid]);
    const rawTexts: string[] = alertsRes.rows.map((r) => r.raw_text);
    if (rawTexts.length === 0) rawTexts.push("Flash flood near cluster centroid");
    const urgencyScores: number[] = alertsRes.rows.map((r) => r.urgency_score);
    if (urgencyScores.length === 0) urgencyScores.push(3);
    const sourcesRaw: string[] = alertsRes.rows.map((r) => r.source);
    const clusterSources: string[] = cluster.sources ? (Array.isArray(cluster.sources) ? cluster.sources : JSON.parse(cluster.sources)) : sourcesRaw;
    const uniqSources = Array.from(new Set(clusterSources.length ? clusterSources : sourcesRaw));
    const sources = uniqSources.length ? uniqSources : ["demo_inject"];

    // Vault snapshot
    let vault = { reserveUSD: 1_000_000, dailyLimitUSD: 100_000, disbursedTodayUSD: 0 };
    try {
      const vres = await pool.query(`SELECT reserve_usd, daily_limit_usd, disbursed_today_usd FROM "Vault_State" WHERE id='singleton'`);
      if (vres.rows.length) {
        const v = vres.rows[0];
        vault = { reserveUSD: Number(v.reserve_usd), dailyLimitUSD: Number(v.daily_limit_usd), disbursedTodayUSD: Number(v.disbursed_today_usd) };
      } else {
        await pool.query(`INSERT INTO "Vault_State" (id, reserve_usd, daily_limit_usd, disbursed_today_usd) VALUES ('singleton', 1000000, 100000, 0) ON CONFLICT (id) DO NOTHING`);
      }
    } catch {}

    const inp: SwarmInput = {
      clusterId: cid as string,
      lat: Number(cluster.lat),
      lon: Number(cluster.lon),
      reportCount: Number(cluster.report_count),
      radiusM: Number(cluster.radius_m),
      sources,
      rawTexts,
      urgencyScores,
      totalFinancialTarget: Number(cluster.total_financial_target ?? 0),
    };

    const quorum = await runSwarmQuorum({ ...inp, vault });

    // Persist votes (idempotent)
    const existingVotes = await pool.query(`SELECT id FROM "Agent_Votes" WHERE cluster_id=$1`, [cid]);
    if (existingVotes.rows.length === 0) {
      for (const v of quorum.votes) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await pool.query(`INSERT INTO "Agent_Votes" (id, cluster_id, agent_type, vote, score, reasoning, signature, tool_proofs) VALUES (gen_random_uuid(), $1,$2,$3,$4,$5,$6,$7::jsonb)`, [cid, v.agentType, v.vote, v.score, v.reasoning, v.signature, JSON.stringify(v.toolProofs)]);
      }
    }

    // Update cluster status + quorumHash
    await pool.query(`UPDATE "Incident_Clusters" SET status=$1, quorum_hash=$2, tier=$3, updated_at=NOW() WHERE id=$4`, [quorum.status, quorum.quorumHash, quorum.tier, cid]);

    return NextResponse.json({ clusterId: cid, quorum, votes: quorum.votes });
  } catch (e) {
    console.error("[swarm/verify] failed", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const clusterId = request.nextUrl.searchParams.get("clusterId");
  if (!clusterId) return NextResponse.json({ error: "clusterId query required" }, { status: 400 });
  try {
    const vres = await pool.query(`SELECT agent_type, vote, score, reasoning, signature, tool_proofs, created_at FROM "Agent_Votes" WHERE cluster_id=$1 ORDER BY agent_type`, [clusterId]);
    const cres = await pool.query(`SELECT id, status, quorum_hash, tier FROM "Incident_Clusters" WHERE id=$1`, [clusterId]);
    if (cres.rows.length === 0) return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
    return NextResponse.json({ cluster: cres.rows[0], votes: vres.rows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
