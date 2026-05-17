# Disaster Recovery Runbook

## Purpose

This runbook explains how to restore AegisAI when the primary server fails, including database restoration and service redeployment.

## Recovery Targets

- **RTO (Recovery Time Objective):** Restore core triage operations as fast as possible.
- **RPO (Recovery Point Objective):** Limited by most recent validated database backup.

## Prerequisites

1. Access to backup artifacts:
   - PostgreSQL logical dumps or snapshot backups.
   - Repository source code.
2. Access to deployment secrets:
   - `DATABASE_URL`
   - `OPENAI_API_KEY` (optional for LLM mode)
   - `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`
3. Docker + Node.js + Python available on recovery host.

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

1. Start Postgres/PostGIS:
   ```bash
   docker compose up -d
   ```
2. Initialize extensions/indexes:
   ```bash
   npm run db:init
   ```
3. Apply Prisma migrations:
   ```bash
   npx prisma migrate deploy
   npm run prisma:generate
   ```
4. Restore latest backup (example):
   ```bash
   docker compose exec -T db psql -U aegis -d aegis < /path/to/latest_backup.sql
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
   DATABASE_URL="postgresql://aegis:aegis_dev_password@localhost:5432/aegis?schema=public"
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

### Step 5: Post-Recovery Verification

1. Confirm ingestion pipeline can write and quarantine correctly.
2. Confirm verified alerts appear on map and priority sidebar.
3. Confirm sector filter behavior.
4. Run core checks:
   ```bash
   npm test
   . brain_service/.venv/bin/activate && cd brain_service && pytest -q
   npm run frontend:lint
   ```

## Failover Operating Mode

If LLM provider is unavailable:

- Brain service continues using heuristic mode (no `OPENAI_API_KEY`) to preserve triage continuity.

If Mapbox token is unavailable:

- Command center still serves priority list and filter controls; map panel shows token-missing guidance.

## Communication Protocol During Outage

1. Declare incident and designate an incident commander.
2. Notify NGO operators of degraded capabilities and estimated restoration stage.
3. Provide updates at fixed intervals until full restoration.
4. Publish post-incident report with timeline, root cause, and corrective actions.

## Hardening After Recovery

1. Rotate credentials used during incident response.
2. Patch host OS and dependencies.
3. Reassess backup cadence and monitoring gaps found during incident.
