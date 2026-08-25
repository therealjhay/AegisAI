import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10), 200);
    const r = await pool.query(
      `SELECT d.*, c.lat, c.lon, c.region FROM "Disbursement_Txs" d
       LEFT JOIN "Incident_Clusters" c ON d.cluster_id = c.id
       ORDER BY d.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return NextResponse.json({
      disbursements: r.rows.map((d) => ({
        ...d,
        amountUSD: Number(d.amount_usd),
      })),
    });
  } catch (e) {
    console.error("[disbursements] failed", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}