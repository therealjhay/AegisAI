import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

// Pillar 1 ingestion + clustering via SQL geography calc (haversine in JS fallback)
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { raw_text, source, coordinates, urgency_score, financial_target_usd, incident_type } = body as {
      raw_text: string;
      source: string;
      coordinates: { lat: number; lon: number };
      urgency_score: number;
      financial_target_usd?: number;
      incident_type?: string;
    };

    if (!raw_text || !source || !coordinates || typeof urgency_score !== "number") {
      return NextResponse.json({ error: "Missing required fields: raw_text, source, coordinates, urgency_score" }, { status: 400 });
    }

    // Credibility check (mirror src/ingestion/verification)
    const credMap: Record<string, number> = { gdacs: 0.95, usgs: 0.95, noaa: 0.9, relweb: 0.85, ngo_partner: 0.75, social_media: 0.3, anonymous_tip: 0.15 };
    const norm = source.trim().toLowerCase().replace(/\s+/g, "_");
    const credibility = credMap[norm] ?? 0.2;
    if (credibility < 0.3) {
      await pool.query(`INSERT INTO "Quarantine_Alerts" ("raw_payload","reason","details") VALUES ($1,$2,$3)`, [JSON.stringify(body), "low_source_credibility", JSON.stringify({ credibility })]);
      return NextResponse.json({ decision: "quarantined", reason: "low_source_credibility", credibility }, { status: 200 });
    }

    // Find nearby cluster (1km / 1h)
    const oneHourAgo = new Date(Date.now() - 3600 * 1000);
    const recent = await pool.query(`SELECT id, lat, lon, "radius_m", report_count, sources, total_financial_target, status, tier FROM "Incident_Clusters" WHERE created_at >= $1 AND status != 'quarantined' ORDER BY created_at DESC LIMIT 50`, [oneHourAgo]);

    let clusterId: string;
    let isNewCluster = false;
    const target = financial_target_usd ?? 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nearby = (recent.rows as any[]).find((c) => haversine(c.lat, c.lon, coordinates.lat, coordinates.lon) <= 1000);

    if (nearby) {
      const sourcesArr: string[] = Array.isArray(nearby.sources) ? nearby.sources : JSON.parse(nearby.sources || "[]");
      const nextSources = sourcesArr.includes(source) ? sourcesArr : [...sourcesArr, source];
      const nextCount = nearby.report_count + 1;
      const nextLat = (nearby.lat * nearby.report_count + coordinates.lat) / nextCount;
      const nextLon = (nearby.lon * nearby.report_count + coordinates.lon) / nextCount;
      const nextRadius = Math.max(nearby.radius_m, haversine(nearby.lat, nearby.lon, coordinates.lat, coordinates.lon));
      const upd = await pool.query(
        `UPDATE "Incident_Clusters" SET lat=$1, lon=$2, "radius_m"=$3, report_count=$4, sources=$5::jsonb, total_financial_target = total_financial_target + $6, updated_at=NOW() WHERE id=$7 RETURNING id`,
        [nextLat, nextLon, nextRadius, nextCount, JSON.stringify(nextSources), target, nearby.id]
      );
      clusterId = upd.rows[0].id;
    } else {
      const created = await pool.query(
        `INSERT INTO "Incident_Clusters" (id, lat, lon, "radius_m", report_count, sources, status, total_financial_target, region) VALUES (gen_random_uuid(), $1,$2,$3,$4,$5::jsonb,'pending',$6,$7) RETURNING id`,
        [coordinates.lat, coordinates.lon, 50, 1, JSON.stringify([source]), target, `${coordinates.lat.toFixed(3)},${coordinates.lon.toFixed(3)}`]
      );
      clusterId = created.rows[0].id;
      isNewCluster = true;
    }

    // Insert alert linked to cluster
    const alertRes = await pool.query(
      `INSERT INTO "Alerts" ("raw_text","source","incident_type","coordinates","urgency_score","financial_target_usd","financial_raised_usd","source_credibility_score","verified_status","timestamp","cluster_id")
       VALUES ($1,$2,$3, ST_SetSRID(ST_MakePoint($4,$5),4326),$6,$7,0,$8,false,NOW(),$9) RETURNING id::text as id`,
      [raw_text, source, incident_type ?? "Natural_Disaster", coordinates.lon, coordinates.lat, urgency_score, target, credibility, clusterId]
    );

    return NextResponse.json({ decision: "saved", clusterId, alertId: alertRes.rows[0].id, isNewCluster, credibility });
  } catch (e) {
    console.error("[ingest] failed", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "POST raw_text, source, coordinates:{lat,lon}, urgency_score to ingest and cluster" });
}
