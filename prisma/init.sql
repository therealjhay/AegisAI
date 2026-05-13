CREATE EXTENSION IF NOT EXISTS postgis;

DO $$
BEGIN
  IF to_regclass('public."Alerts"') IS NOT NULL THEN
    ALTER TABLE "Alerts"
      DROP CONSTRAINT IF EXISTS alerts_urgency_score_check;

    ALTER TABLE "Alerts"
      ADD CONSTRAINT alerts_urgency_score_check
      CHECK ("urgency_score" BETWEEN 1 AND 5);

    ALTER TABLE "Alerts"
      DROP CONSTRAINT IF EXISTS alerts_source_credibility_score_check;

    ALTER TABLE "Alerts"
      ADD CONSTRAINT alerts_source_credibility_score_check
      CHECK ("source_credibility_score" >= 0 AND "source_credibility_score" <= 1);

    CREATE INDEX IF NOT EXISTS alerts_coordinates_gix
      ON "Alerts"
      USING GIST ("coordinates");
  END IF;

  IF to_regclass('public."Quarantine_Alerts"') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS quarantine_alerts_created_at_idx
      ON "Quarantine_Alerts" ("created_at");
  END IF;
END $$;
