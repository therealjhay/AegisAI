# AegisAI Comprehensive System Manual

## 1. Purpose

AegisAI is a defensive disaster-triage platform for NGOs. It ingests raw incident reports, verifies and scores them, classifies life-threat urgency, and presents verified alerts on a geospatial command center for deployment decisions.

## 2. System Scope

Implemented phases:

1. **Phase 1 (Data Core):** PostgreSQL 16 + PostGIS + Prisma schema bootstrap.
2. **Phase 2 (Skeptic Ingestion):** TypeScript verification pipeline with quarantine controls.
3. **Phase 3 (Brain):** Python FastAPI triage microservice for disaster typing, urgency scoring, location extraction.
4. **Phase 4 (Command Center):** Next.js 14 + Tailwind + Mapbox operational frontend.

## 3. High-Level Architecture

```text
Raw Reports -> Ingestion Service (TS) -> Alerts / Quarantine_Alerts (Postgres+PostGIS)
                                  \
                                   -> Brain Service (FastAPI) for triage enrichment

Command Center (Next.js)
   -> /api/alerts/heatmap
   -> /api/alerts/priority
   -> /api/sectors
      -> PostgreSQL reads (verified alerts + sector options)
      -> Mapbox GL heatmap + priority sidebar for operators
```

## 4. Core Components

### 4.1 Database Layer (PostgreSQL + PostGIS)

Primary tables:

- `Alerts`: verified/ingested incidents (`raw_text`, `source`, `coordinates`, `urgency_score`, `verified_status`, `timestamp`, `source_credibility_score`).
- `Quarantine_Alerts`: rejected/suspicious payloads with reasons and details.
- `NGO_Users`: NGO organization metadata and sector specialization.

Spatial behavior:

- `coordinates` stored as `geometry(Point, 4326)`.
- PostGIS functions (`ST_DWithin`, `ST_X`, `ST_Y`) support duplicate checks and mapping.

### 4.2 Ingestion Service (`src/ingestion`)

Responsibilities:

1. Validate incoming payloads with Zod.
2. Score source credibility.
3. Detect duplicates within 1 km during the past hour.
4. Quarantine low-trust/invalid/duplicate payloads.
5. Persist accepted alerts.

Outcome:

- Reduces noise and adversarial data before data reaches operators.

### 4.3 Brain Service (`brain_service`)

FastAPI service endpoint: `POST /triage`.

Responsibilities:

1. Extract disaster type (flood, fire, earthquake, etc.).
2. Estimate urgency score (1-5) based on threat to life.
3. Extract location/landmark mentions from raw text.
4. Return structured JSON output.

Inference mode:

- Uses direct OpenAI call when `OPENAI_API_KEY` is available.
- Falls back to deterministic heuristics when unavailable.

### 4.4 Command Center Frontend (`frontend`)

Responsibilities:

1. Render real-time heatmap of verified alerts with Mapbox GL JS.
2. Show top 5 most urgent verified alerts in Priority Sidebar.
3. Provide sector filtering (query-string based) for operational focus.
4. Offer loading/empty/error states and high-contrast, keyboard-accessible controls.

## 5. Runtime Services & Ports

- PostgreSQL/PostGIS: `localhost:5432`
- Brain service (FastAPI): `localhost:8001` (recommended)
- Command center (Next.js): `localhost:3000` (default)

## 6. Environment Configuration

### 6.1 Root `.env`

```bash
DATABASE_URL="postgresql://aegis:aegis_dev_password@localhost:5432/aegis?schema=public"
```

### 6.2 Frontend `.env.local`

```bash
DATABASE_URL="postgresql://aegis:aegis_dev_password@localhost:5432/aegis?schema=public"
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN="your_mapbox_public_token"
```

### 6.3 Brain Service (optional LLM mode)

```bash
OPENAI_API_KEY="your_openai_api_key"
```

## 7. Standard Startup Procedure

1. Install root dependencies:
   ```bash
   npm install
   ```
2. Start database:
   ```bash
   docker compose up -d
   npm run db:init
   ```
3. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```
4. Start Brain service:
   ```bash
   python3 -m venv brain_service/.venv
   . brain_service/.venv/bin/activate
   pip install -r brain_service/requirements.txt
   cd brain_service && uvicorn app.main:app --reload --port 8001
   ```
5. Start Command Center:
   ```bash
   npm --prefix frontend install
   npm run frontend:dev
   ```

## 8. Data Flow (Operator View)

1. Raw alert enters ingestion.
2. Verification/quarantine rules evaluate risk and trust.
3. Accepted alert persists in `Alerts`.
4. Brain service produces triage structuring.
5. Command center fetches verified alerts and renders:
   - heat concentration zones,
   - top urgent incidents,
   - sector-filtered operational slices.
6. NGO operations team assigns and dispatches field resources.

## 9. Monitoring & Health Checks

- Brain service health: `GET /health` on FastAPI.
- Frontend route/API health:
  - `GET /api/alerts/heatmap`
  - `GET /api/alerts/priority`
  - `GET /api/sectors`
- Database connectivity validated through successful API responses and ingestion writes.

## 10. Testing & Validation Commands

- Root TypeScript validation:
  ```bash
  npm test
  ```
- Brain service tests:
  ```bash
  . brain_service/.venv/bin/activate
  cd brain_service && pytest -q
  ```
- Frontend quality checks:
  ```bash
  npm run frontend:lint
  npm run frontend:build
  ```

## 11. Operational Safety Practices

1. Keep `verified_status` gating active; avoid presenting unverified alerts as deployment-ready.
2. Review `Quarantine_Alerts` regularly for adversarial patterns.
3. Rotate API keys and DB credentials on schedule.
4. Limit production access to need-to-know operator roles.
5. Treat source credibility and urgency as decision support, not sole authority.

## 12. Handover Artifacts

- `API_REFERENCE.openapi.yaml` (technical API reference)
- `SECURITY.md` (hardening and honey-pot misuse mitigation)
- `DISASTER_RECOVERY.md` (redeployment runbook)
- `NGO_WORKFLOW_SUMMARY.md` (operator lifecycle summary)
