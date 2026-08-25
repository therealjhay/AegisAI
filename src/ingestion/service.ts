import { PrismaClient, Prisma } from "@prisma/client";
import { incomingAlertSchema } from "./schema.js";
import { verifyAlert } from "./verification.js";
import { findOrCreateCluster } from "./cluster.js";

export type IngestionDecision = "saved" | "quarantined";

export type IngestionResult = {
  decision: IngestionDecision;
  clusterId?: string;
  alertId?: string;
  isNewCluster?: boolean;
};

/**
 * Ingests untrusted alerts with strict validation + verification gates.
 */
export class IngestionService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Processes one incoming payload and routes to Alerts or Quarantine_Alerts.
   * Pillar 1 extension: also clusters geographically overlapping reports.
   */
  async process(rawPayload: unknown): Promise<IngestionDecision> {
    const res = await this.processWithCluster(rawPayload);
    return res.decision;
  }

  async processWithCluster(rawPayload: unknown): Promise<IngestionResult> {
    const parsed = incomingAlertSchema.safeParse(rawPayload);
    if (!parsed.success) {
      await this.quarantine(rawPayload, "schema_validation_failed", parsed.error.flatten());
      return { decision: "quarantined" };
    }

    const verification = await verifyAlert(this.prisma, parsed.data);
    if (verification.sourceCredibilityScore < 0.6) {
      await this.quarantine(rawPayload, "low_source_credibility", verification);
      return { decision: "quarantined" };
    }

    // Pillar 1: cluster first — even near-dupes enrich the cluster instead of being dropped silently
    const cluster = await findOrCreateCluster(this.prisma, parsed.data);

    // Insert alert linked to cluster
    const inserted: Array<{ id: bigint }> = await this.prisma.$queryRaw`
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
        "timestamp",
        "cluster_id"
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
        ${parsed.data.timestamp ? new Date(parsed.data.timestamp) : new Date()},
        ${cluster.clusterId}
      )
      RETURNING id
    `;

    return {
      decision: "saved",
      clusterId: cluster.clusterId,
      alertId: String(inserted[0]?.id ?? ""),
      isNewCluster: cluster.isNew,
    };
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
