import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clusterId: string }> }
) {
  try {
    const { clusterId } = await params;
    if (!clusterId) return NextResponse.json({ error: "clusterId required" }, { status: 400 });

    const [clusterRes, votesRes, disbRes, alertsRes] = await Promise.all([
      pool.query(`SELECT * FROM "Incident_Clusters" WHERE id=$1`, [clusterId]),
      pool.query(`SELECT agent_type, vote, score, reasoning, signature, tool_proofs, created_at FROM "Agent_Votes" WHERE cluster_id=$1 ORDER BY agent_type`, [clusterId]),
      pool.query(`SELECT * FROM "Disbursement_Txs" WHERE cluster_id=$1 ORDER BY created_at DESC`, [clusterId]),
      pool.query(`SELECT id::text as id, raw_text, source, urgency_score, financial_target_usd, financial_raised_usd, source_credibility_score, verified_status, timestamp FROM "Alerts" WHERE cluster_id=$1 ORDER BY timestamp DESC`, [clusterId]),
    ]);

    if (clusterRes.rows.length === 0) return NextResponse.json({ error: "Cluster not found" }, { status: 404 });

    const cluster = clusterRes.rows[0];
    const votes = votesRes.rows.map((v) => ({
      agentType: v.agent_type,
      vote: v.vote,
      score: Number(v.score),
      reasoning: v.reasoning,
      signature: v.signature,
      toolProofs: v.tool_proofs,
      createdAt: v.created_at,
    }));
    const disbursements = disbRes.rows;
    const alerts = alertsRes.rows;

    // Build audit summary
    const yesCount = votes.filter((v) => v.vote === "yes").length;
    const quorumReached = yesCount >= 3;

    return NextResponse.json({
      cluster: {
        ...cluster,
        lat: Number(cluster.lat),
        lon: Number(cluster.lon),
        radiusM: Number(cluster.radius_m),
        reportCount: Number(cluster.report_count),
        totalFinancialTarget: Number(cluster.total_financial_target),
        tier: cluster.tier,
      },
      votes,
      quorum: { yesCount, quorumReached, quorumHash: cluster.quorum_hash, status: cluster.status },
      disbursements,
      alerts,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[audit] failed", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}