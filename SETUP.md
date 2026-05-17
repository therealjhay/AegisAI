# Aegis Phase 1 Setup (PostgreSQL 16 + PostGIS 3 + Prisma)

This phase provisions a local PostGIS database and creates Prisma models for `Alerts` and `NGO_Users`.

## 1. Install dependencies

```bash
npm install
```

## 2. Start PostgreSQL + PostGIS

```bash
docker compose up -d
```

The service starts:

- **PostgreSQL** `16`
- **PostGIS** `3.x`
- Host port: `5432`

Default credentials from `docker-compose.yml`:

- Database: `aegis`
- User: `aegis`
- Password: `aegis_dev_password`

## 3. Set Prisma connection string

Create `.env` in the repository root:

```bash
DATABASE_URL="postgresql://aegis:aegis_dev_password@localhost:5432/aegis?schema=public"
```

## 4. Initialize schema with Prisma

Before migration, ensure `postgis` is enabled (safe to run repeatedly):

```bash
npm run db:init
```

Generate and apply the initial migration:

```bash
npx prisma migrate dev --name init
```

This creates:

- `Alerts` table with:
  - `id`
  - `raw_text`
  - `source`
  - `coordinates` (`geometry(Point, 4326)`)
  - `urgency_score`
  - `verified_status`
  - `timestamp`
- `NGO_Users` table with:
  - `id`
  - `organization_name`
  - `sector`
  - `active_region`

## 5. Enable PostGIS and create spatial index

Run the initialization SQL:

```bash
npm run db:init
```

What it does (`prisma/init.sql`):

1. Enables `postgis` extension.
2. Adds/refreshes `Alerts.urgency_score` check constraint (`1..5`).
3. Creates GiST spatial index on `Alerts.coordinates`.

## 6. Validate Prisma schema

```bash
npm test
```

## 7. Phase 2 ingestion service

Apply the updated Prisma schema (adds source credibility field and quarantine table):

```bash
npx prisma migrate dev --name phase2_ingestion
npm run db:init
npm run prisma:generate
```

Run mock ingestion:

```bash
npm run ingest:mock
```

## 8. Phase 3 AI triage microservice (FastAPI)

Install Python dependencies:

```bash
python3 -m venv brain_service/.venv
. brain_service/.venv/bin/activate
pip install -r brain_service/requirements.txt
```

Run the service:

```bash
cd brain_service
uvicorn app.main:app --reload --port 8001
```

Run tests:

```bash
cd brain_service
pytest -q
```

## 9. Phase 4 command center (Next.js 14 + Mapbox)

Install frontend dependencies:

```bash
npm --prefix frontend install
```

Create `frontend/.env.local`:

```bash
DATABASE_URL="postgresql://aegis:aegis_dev_password@localhost:5432/aegis?schema=public"
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN="your_mapbox_public_token"
```

Run the command center:

```bash
npm run frontend:dev
```

Useful frontend commands:

```bash
npm run frontend:lint
npm run frontend:build
```
