import { PrismaClient, Prisma } from "@prisma/client";
import { incomingAlertSchema } from "./schema.js";
import { verifyAlert } from "./verification.js";

export type IngestionDecision = "saved" | "quarantined";

/**
 * Ingests untrusted alerts with strict validation + verification gates.
 */
export class IngestionService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Processes one incoming payload and routes to Alerts or Quarantine_Alerts.
   */
  async process(rawPayload: unknown): Promise<IngestionDecision> {
    const parsed = incomingAlertSchema.safeParse(rawPayload);
    if (!parsed.success) {
      await this.quarantine(rawPayload, "schema_validation_failed", parsed.error.flatten());
      return "quarantined";
    }

    const verification = await verifyAlert(this.prisma, parsed.data);
    if (verification.duplicateWithin1KmLastHour) {
      await this.quarantine(rawPayload, "duplicate_within_1km_last_hour", verification);
      return "quarantined";
    }

    if (verification.sourceCredibilityScore < 0.6) {
      await this.quarantine(rawPayload, "low_source_credibility", verification);
      return "quarantined";
    }

    await this.prisma.$executeRaw`
      INSERT INTO "Alerts" (
        "raw_text",
        "source",
        "incident_type",
        "coordinates",
        "urgency_score",
        "financial_target_usd",
        "financial_raised_usd",
        "source_credibility_score",
        "verified_status",
        "timestamp"
      )
      VALUES (
        ${parsed.data.raw_text},
        ${parsed.data.source},
        ${parsed.data.incident_type},
        ST_SetSRID(ST_MakePoint(${parsed.data.coordinates.lon}, ${parsed.data.coordinates.lat}), 4326),
        ${parsed.data.urgency_score},
        ${parsed.data.financial_target_usd},
        0,
        ${verification.sourceCredibilityScore},
        ${parsed.data.verified_status ?? false},
        ${parsed.data.timestamp ? new Date(parsed.data.timestamp) : new Date()}
      )
    `;

    return "saved";
  }

  /**
   * Persists quarantined payloads for later security and quality review.
   */
  private async quarantine(rawPayload: unknown, reason: string, details: unknown): Promise<void> {
    await this.prisma.quarantineAlert.create({
      data: {
        rawPayload: toInputJsonValue(rawPayload),
        reason,
        details: toInputJsonValue(details)
      }
    });
  }
}

/**
 * Converts unknown values to Prisma-safe JSON by serializing first.
 */
function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
