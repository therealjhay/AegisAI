import { PrismaClient } from "@prisma/client";
import { mockAlertStream } from "./mockStream.js";
import { IngestionService } from "./service.js";

/**
 * Bootstraps the mock ingestion stream and processes each record.
 */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const service = new IngestionService(prisma);

  try {
    for (const payload of mockAlertStream) {
      const decision = await service.process(payload);
      // Keep operational logs explicit for audit trail.
      console.log(`[ingestion] decision=${decision}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("[ingestion] fatal_error", error);
  process.exit(1);
});
