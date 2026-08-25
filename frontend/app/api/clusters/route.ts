import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status") ?? undefined;
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10), 200);
    const offset = parseInt(request.nextUrl.searchParams.get("offset") ?? "0", 10);

    const where = status ? `WHERE status = $1` : "";
    const params = status ? [status] : [];

    const r = await pool.query(
      `SELECT id, lat, lon, "radius_m", report_count, sources, status, tier, total_financial_target, quorum_hash, region, created_at, updated_at
       FROM "Incident_Clusters"
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      clusters: r.rows.map((c) => ({
        ...c,
        lat: Number(c.lat),
        lon: Number(c.lon),
        radiusM: Number(c.radius_m),
        reportCount: Number(c.report_count),
        totalFinancialTarget: Number(c.total_financial_target),
      })),
    });
  } catch (e) {
    console.error("[clusters] failed", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}