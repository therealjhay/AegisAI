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

  IF to_regclass('public."Incident_Clusters"') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS incident_clusters_status_idx ON "Incident_Clusters" ("status");
    CREATE INDEX IF NOT EXISTS incident_clusters_created_at_idx ON "Incident_Clusters" ("created_at");
  END IF;

  IF to_regclass('public."Agent_Votes"') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS agent_votes_cluster_idx ON "Agent_Votes" ("cluster_id");
    CREATE INDEX IF NOT EXISTS agent_votes_agent_type_idx ON "Agent_Votes" ("agent_type");
  END IF;

  IF to_regclass('public."Disbursement_Txs"') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS disbursement_txs_cluster_idx ON "Disbursement_Txs" ("cluster_id");
    CREATE INDEX IF NOT EXISTS disbursement_txs_sig_idx ON "Disbursement_Txs" ("tx_signature");
  END IF;
END $$;
