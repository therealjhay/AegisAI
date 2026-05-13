import { z } from "zod";

/**
 * Schema for incoming untrusted alert payloads.
 * Every payload must pass this gate before any verification logic runs.
 */
export const incomingAlertSchema = z.object({
  raw_text: z.string().trim().min(1).max(10000),
  source: z.string().trim().min(1).max(128),
  coordinates: z.object({
    lat: z.number().gte(-90).lte(90),
    lon: z.number().gte(-180).lte(180)
  }),
  urgency_score: z.number().int().min(1).max(5),
  verified_status: z.boolean().optional().default(false),
  timestamp: z.string().datetime().optional()
});

export type IncomingAlert = z.infer<typeof incomingAlertSchema>;
