# Phase 2 - Skeptic Ingestion Service

This module ingests untrusted alert events and applies mandatory verification before map persistence.

## What it does

1. Validates incoming JSON with Zod (`incomingAlertSchema`).
2. Scores source credibility (`scoreSourceCredibility`).
3. Checks for nearby duplicates within **1km** over the last **1 hour** using PostGIS `ST_DWithin`.
4. Routes invalid or suspicious payloads into `Quarantine_Alerts` for audit.
5. Saves only accepted alerts into `Alerts`.

## Run locally

1. Ensure database is running and migrated:
   - `docker compose up -d`
   - `npx prisma migrate dev --name phase2_ingestion`
   - `npm run db:init`
2. Generate Prisma client:
   - `npm run prisma:generate`
3. Start mock ingestion stream:
   - `npm run ingest:mock`

## Security behavior

- Unknown/low-trust sources are quarantined (`low_source_credibility`).
- Spatial/temporal duplicates are quarantined (`duplicate_within_1km_last_hour`).
- Schema failures are quarantined with validation detail (`schema_validation_failed`).
