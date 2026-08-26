# AEGIS — Disaster Recovery Runbook

This runbook restores the AEGIS platform (ingestion + swarm + vault + command center) if a primary deployment fails. It covers local and hosted (Supabase) database restoration and redeployment.

## Recovery Targets

- **RTO (Recovery Time Objective):** Restore verification + settlement operations as fast as possible.
- **RPO (Recovery Point Objective):** Limited by the most recent validated database backup.

## Prerequisites

1. Access to backup artifacts:
   - PostgreSQL logical dumps or snapshot backups (local `aegis` db, or the hosted Supabase project).
   - Repository source code.
2. Access to deployment secrets:
   - `DATABASE_URL`
   - `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`
   - `OPENAI_API_KEY` + `USE_LLM_SWARM` (optional for LLM mode)
   - Agent signing secrets (`AGENT_*_SECRET`) — needed to reproduce valid signatures.
3. Docker + Node.js + Python available on the recovery host.

## Backup Policy (Recommended)

1. **Database backup cadence:** at least daily logical dump; more frequent for high-volume operations.
2. **Retention:** keep rolling history (e.g., 7 daily + 4 weekly + monthly snapshots).
3. **Validation:** test restore from backup routinely.
4. **Off-site storage:** keep encrypted copy in separate region/provider.

## Recovery Procedure

### Step 1: Provision Recovery Host

1. Install Docker, Node.js, Python3.
2. Clone repository:
   ```bash
   git clone <repo-url>
   cd AegisAI
   ```
3. Install dependencies:
   ```bash
   npm install
   npm --prefix frontend install
   ```

### Step 2: Restore Database Service

**Local (Docker) deployment:**

1. Start Postgres/PostGIS:
   ```bash
   docker compose up -d
   ```
2. Initialize extensions/indexes:
   ```bash
   npm run db:init
   ```
3. Bootstrap the V2 schema (tables + seed):
   ```bash
   psql "postgresql://aegis:aegis_dev_password@localhost:5444/aegis" -f prisma/setup.sql
   psql "postgresql://aegis:aegis_dev_password@localhost:5444/aegis" -f prisma/seed.sql
   ```
4. Restore latest backup (if restoring a prior point):
   ```bash
   docker compose exec -T db psql -U aegis -d aegis < /path/to/latest_backup.sql
   ```

**Hosted (Supabase) deployment:**

1. Point `DATABASE_URL` at the Supabase pooler connection string.
2. Bootstrap the schema (idempotent):
   ```bash
   psql "$DATABASE_URL" -f prisma/setup.sql
   psql "$DATABASE_URL" -f prisma/seed.sql
   ```
3. To restore a logical backup, pipe the dump into the pooler as `sslmode=require`:
   ```bash
   psql "$DATABASE_URL" -f /path/to/latest_backup.sql
   ```

### Step 3: Restore Brain Service

1. Create virtual environment:
   ```bash
   python3 -m venv brain_service/.venv
   . brain_service/.venv/bin/activate
   pip install -r brain_service/requirements.txt
   ```
2. Set environment values (`OPENAI_API_KEY` optional).
3. Start service:
   ```bash
   cd brain_service
   uvicorn app.main:app --host 0.0.0.0 --port 8001
   ```
4. Validate:
   ```bash
   curl http://localhost:8001/health
   ```

### Step 4: Restore Command Center

1. Configure `frontend/.env.local`:
   ```bash
   DATABASE_URL="postgresql://aegis:aegis_dev_password@localhost:5444/aegis?schema=public"
   NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN="your_mapbox_public_token"
   ```
2. Build and start:
   ```bash
   npm run frontend:build
   npm --prefix frontend run start
   ```
3. Validate APIs:
   - `GET /api/sectors`
   - `GET /api/alerts/heatmap`
   - `GET /api/alerts/priority`
   - `GET /api/clusters`
   - `GET /api/vault/state`
   - `POST /api/swarm/verify` (with a `clusterId` or `raw_text`)

### Step 5: Post-Recovery Verification

1. Confirm the ingestion pipeline can write and quarantine correctly.
2. Confirm verified alerts appear on the map and priority sidebar.
3. Inject a test report → confirm it clusters → confirm the swarm votes → confirm a disbursement path exposes tx + audit data.
4. Confirm vault state (reserve / daily limit / remaining) renders and updates.
5. Run core checks:
   ```bash
   npm test
   . brain_service/.venv/bin/activate && cd brain_service && pytest -q
   npm run frontend:lint
   ```

## Failover Operating Mode

If the LLM provider is unavailable:

- Brain service continues in deterministic heuristic mode (no `OPENAI_API_KEY`) so verification continuity is preserved.

If the blockchain RPC is unavailable (production Solana mode):

- The vault can still record a settlement using the deterministic mock signature; on-chain confirmation is deferred until the RPC returns.

If Mapbox token is unavailable:

- The command center still serves the priority list and filter controls; the map panel shows token-missing guidance and degrades to List-Only mode.

## Communication Protocol During Outage

1. Declare incident and designate an incident commander.
2. Notify NGO operators of degraded capabilities and estimated restoration stage.
3. Provide updates at fixed intervals until full restoration.
4. Publish post-incident report with timeline, root cause, and corrective actions.

## Hardening After Recovery

1. Rotate credentials used during incident response.
2. Patch host OS and dependencies.
3. Reassess backup cadence and monitoring gaps found during incident.
