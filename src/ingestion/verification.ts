import type { PrismaClient } from "@prisma/client";
import type { IncomingAlert } from "./schema.js";

/**
 * Configuration for credibility scoring by source.
 * Unknown sources intentionally score low to enforce manual review.
 */
const SOURCE_CREDIBILITY_MAP: Record<string, number> = {
  gdacs: 0.95,
  usgs: 0.95,
  noaa: 0.9,
  relweb: 0.85,
  ngo_partner: 0.75,
  social_media: 0.3,
  anonymous_tip: 0.15
};

const DEFAULT_CREDIBILITY_SCORE = 0.2;

export type VerificationResult = {
  sourceCredibilityScore: number;
  duplicateWithin1KmLastHour: boolean;
};

/**
 * Scores source reliability by normalized source key.
 */
export function scoreSourceCredibility(source: string): number {
  const normalized = source.trim().toLowerCase().replace(/\s+/g, "_");
  return SOURCE_CREDIBILITY_MAP[normalized] ?? DEFAULT_CREDIBILITY_SCORE;
}

/**
 * Detects likely duplicate reports near the same location in the previous hour.
 */
export async function hasRecentDuplicate(
  prisma: PrismaClient,
  input: IncomingAlert
): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ duplicate_count: bigint }>>`
    SELECT COUNT(*)::bigint AS duplicate_count
    FROM "Alerts"
    WHERE "timestamp" >= NOW() - INTERVAL '1 hour'
      AND ST_DWithin(
        "coordinates"::geography,
        ST_SetSRID(ST_MakePoint(${input.coordinates.lon}, ${input.coordinates.lat}), 4326)::geography,
        1000
      )
  `;

  const duplicateCount = rows[0]?.duplicate_count ?? 0n;
  return duplicateCount > 0n;
}

/**
 * Runs all verification checks required before map persistence.
 */
export async function verifyAlert(
  prisma: PrismaClient,
  input: IncomingAlert
): Promise<VerificationResult> {
  const [duplicateWithin1KmLastHour, sourceCredibilityScore] = await Promise.all([
    hasRecentDuplicate(prisma, input),
    Promise.resolve(scoreSourceCredibility(input.source))
  ]);

  return {
    sourceCredibilityScore,
    duplicateWithin1KmLastHour
  };
}
