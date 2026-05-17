import { pool } from "@/lib/db";

const sectorCaseSql = `
  CASE
    WHEN lower(a.raw_text) ~ '(injur|hospital|clinic|medical|ambulance|medicine)' THEN 'Medical'
    WHEN lower(a.raw_text) ~ '(shelter|evacuation center|displaced|temporary housing|camp)' THEN 'Shelter'
    WHEN lower(a.raw_text) ~ '(food|hunger|nutrition|ration)' THEN 'Food'
    WHEN lower(a.raw_text) ~ '(water|sanitation|clean water|hygiene)' THEN 'Water'
    WHEN lower(a.raw_text) ~ '(rescue|trapped|search and rescue|evacuate now)' THEN 'Rescue'
    WHEN lower(a.raw_text) ~ '(road closed|bridge|transport|logistics|supply route)' THEN 'Logistics'
    ELSE 'General'
  END
`;

export type HeatmapPoint = {
  id: string;
  lat: number;
  lon: number;
  urgencyScore: number;
  sector: string;
  timestamp: string;
};

export type PriorityAlert = {
  id: string;
  rawText: string;
  source: string;
  urgencyScore: number;
  sector: string;
  timestamp: string;
};

export async function getHeatmapPoints(sector?: string): Promise<HeatmapPoint[]> {
  const hasSector = Boolean(sector && sector !== "All");
  const sql = `
    SELECT
      a.id::text AS id,
      ST_Y(a.coordinates) AS lat,
      ST_X(a.coordinates) AS lon,
      a.urgency_score AS "urgencyScore",
      ${sectorCaseSql} AS sector,
      a.timestamp::text AS timestamp
    FROM "Alerts" a
    WHERE a.verified_status = true
      ${hasSector ? `AND ${sectorCaseSql} = $1` : ""}
    ORDER BY a.timestamp DESC
    LIMIT 1000;
  `;
  const result = hasSector
    ? await pool.query<HeatmapPoint>(sql, [sector])
    : await pool.query<HeatmapPoint>(sql);
  return result.rows;
}

export async function getPriorityAlerts(sector?: string): Promise<PriorityAlert[]> {
  const hasSector = Boolean(sector && sector !== "All");
  const sql = `
    SELECT
      a.id::text AS id,
      a.raw_text AS "rawText",
      a.source,
      a.urgency_score AS "urgencyScore",
      ${sectorCaseSql} AS sector,
      a.timestamp::text AS timestamp
    FROM "Alerts" a
    WHERE a.verified_status = true
      ${hasSector ? `AND ${sectorCaseSql} = $1` : ""}
    ORDER BY a.urgency_score DESC, a.timestamp DESC
    LIMIT 5;
  `;
  const result = hasSector
    ? await pool.query<PriorityAlert>(sql, [sector])
    : await pool.query<PriorityAlert>(sql);
  return result.rows;
}

export async function getSectors(): Promise<string[]> {
  const ngoSectorsResult = await pool.query<{ sector: string }>(`
    SELECT DISTINCT sector
    FROM "NGO_Users"
    WHERE sector IS NOT NULL AND length(trim(sector)) > 0
    ORDER BY sector ASC;
  `);

  const inferredSectorsResult = await pool.query<{ sector: string }>(`
    SELECT DISTINCT ${sectorCaseSql} AS sector
    FROM "Alerts" a
    WHERE a.verified_status = true
    ORDER BY sector ASC;
  `);

  const set = new Set<string>(["All"]);
  for (const row of ngoSectorsResult.rows) {
    set.add(row.sector.trim());
  }
  for (const row of inferredSectorsResult.rows) {
    set.add(row.sector.trim());
  }
  return Array.from(set);
}
