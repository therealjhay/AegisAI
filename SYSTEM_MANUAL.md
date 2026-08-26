# AEGIS — System Manual

A comprehensive architecture and operations manual for the AEGIS decentralized autonomous disaster response & parametric micro-grants dispatcher.

---

## 1. Purpose

AEGIS ingests raw incident reports from multiple channels, clusters them into geographic incident zones, verifies them with a multi-agent consensus swarm, and — only when real — releases risk-capped micro-grants with a full cryptographic audit trail. It presents all of this to NGO operators on a real-time geospatial command center.

This manual documents the system's architecture, components, data flows, APIs, operations, and testing.

---

## 2. System Scope

AEGIS delivers four functional pillars:

1. **Pillar 1 — OSINT Ingestion & Geo-Clustering**
2. **Pillar 2 — Multi-Agent Verification Quorum (3-of-4)**
3. **Pillar 3 — Parametric Vault Settlement**
4. **Pillar 4 — Verifiable Audit Trail**

Plus an operator-facing Command Center (Next.js + Mapbox) that surfaces all four pillars.

---

## 3. High-Level Architecture

```text
┌─────────────── CHANNELS ───────────────┐
│ SMS · Social Media · Partner Feed      │
│ Weather/OSINT · Operator entry         │
└───────────────────┬────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  INGESTION (src/ingestion)  · TypeScript                            │
│  Zod validation → source credibility → duplicate suppression        │
│  → quarantine routing → persist Alert                               │
└───────────────────────────┬─────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  GEO-CLUSTERING (src/ingestion/cluster.ts)                          │
│  Haversine ≤1km within 60min → group into IncidentCluster           │
└───────────────────────────┬─────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  MULTI-AGENT QUORUM (src/swarm)                                     │
│  triangulator · fact_checker · triage_evaluator · risk_governor     │
│  orchestrator: ≥3-of-4 yes → verified                               │
└───────────────────────────┬─────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PARAMETRIC VAULT (src/vault/service.ts)                            │
│  re-verify sigs · incident/daily/reserve caps · mint tx signature   │
└───────────────────────────┬─────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  DATA LAYER  ·  PostgreSQL 16 + PostGIS + Prisma                    │
│  Alerts · Incident_Clusters · Agent_Votes · Disbursement_Txs        │
│  Vault_State · NGO_Users · Quarantine_Alerts                        │
└───────────────────────────┬─────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  COMMAND CENTER (frontend)  ·  Next.js 14 + Mapbox GL               │
│  live map · priority sidebar · swarm panel · audit view · vault     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Core Components

### 4.1 Database Layer (PostgreSQL 16 + PostGIS 3)

Primary tables:

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `Alerts` | Verified/ingested incidents | `raw_text`, `source`, `incident_type`, `coordinates (geometry)`, `urgency_score`, `verified_status`, `cluster_id` |
| `Incident_Clusters` | Grouped incidents (Pillar 1) | `lat`, `lon`, `radius_m`, `report_count`, `status`, `tier`, `total_financial_target`, `quorum_hash` |
| `Agent_Votes` | Verdicts per agent (Pillar 2) | `agent_type`, `vote`, `score`, `reasoning`, `signature`, `tool_proofs` |
| `Disbursement_Txs` | Settlement records (Pillar 3) | `amount_usd`, `recipient_wallet`, `quorum_hash`, `tx_signature`, `explorer_url`, `status` |
| `Vault_State` | Singleton funding state | `reserve_usd`, `daily_limit_usd`, `disbursed_today_usd` |
| `NGO_Users` | Verifiable payout recipients | `organization_name`, `sector`, `wallet_address`, `is_verified` |
| `Quarantine_Alerts` | Rejected/suspicious payloads | `raw_payload`, `reason`, `details` |

Spatial behavior:

- `Alerts.coordinates` stored as `geometry(Point, 4326)`.
- PostGIS functions (`ST_X`, `ST_Y`, `ST_DWithin`, GiST index) support mapping and verification.
- Clustering uses a JavaScript haversine fallback (see §4.2) to avoid a PostGIS dependency on cluster tables.

### 4.2 Ingestion Service (`src/ingestion/`)

Responsibilities:

1. Validate incoming payloads with Zod (`schema.ts`).
2. Score source credibility (`verification.ts`).
3. Detect duplicates within 1&nbsp;km over the past hour.
4. Quarantine low-trust/invalid/duplicate payloads.
5. Persist accepted alerts and link them to clusters (`service.ts` → `processWithCluster`).
6. Provide mock OSINT generators (`osint.ts`) for demo enrichment.

### 4.3 Geo-Clustering (`src/ingestion/cluster.ts`)

- Finds a nearby cluster via Haversine `≤ 1000 m` within the last 60 minutes.
- Recomputes moving centroid + `radius_m` on each merge.
- Creates a fresh cluster (`radius_m: 50`, `report_count: 1`) when no match exists.
- Fully **location-agnostic** — works at any coordinate on Earth.

### 4.4 Multi-Agent Verification Swarm (`src/swarm/`)

Four agents implement `AgentVoteResult`; the orchestrator (`orchestrator.ts`) applies the `3-of-4` rule.

| Agent | File | Vote Logic | Tool Proofs |
|-------|------|-----------|-------------|
| **Triangulator** | `agents/triangulator.ts` | Corroboration of location by multiple reports | `geoCorroboration`, `spreadLatLng` |
| **Fact-Checker** | `agents/factChecker.ts` | Source credibility vs. thresholds | `credibility`, `confirmations` |
| **Triage Evaluator** | `agents/triageEvaluator.ts` | Urgency → tier → proposed amount | `tier`, `maxUrgency`, `amount` |
| **Risk Governor** | `agents/riskGovernor.ts` | Cap/abstain/veto against vault | `tier`, `hardCap`, `effective` |

**Orchestrator flow** (`runSwarmQuorum`):
1. Run triage first to derive `tier` + `amount`.
2. Run triangulator, fact-checker, and governor in parallel.
3. Collect votes, count `yes`.
4. `≥3 yes and cappedAmount > 0` → **verified**; `≥2 no` → **quarantined**; else **audit_required**.
5. Compute `quorumHash` over sorted signatures.

### 4.5 Crypto / Signatures (`src/swarm/crypto.ts`)

- `signVote`: HMAC-SHA256 over `agentType:clusterId:vote:score`. Per-agent secrets (env or defaults). **Mock ed25519** for demo; swappable for real Solana `@noble/ed25519`.
- `verifyVote`: re-derives the expected signature and compares.
- `quorumHash`: SHA-256 over the **sorted** `agentType:vote:signature[:16]` tuples — order-independent, tamper-evident.
- `mockTxSignature`: SHA-256 over `clusterId:quorumHash:amount:time`. **Mock chain**; swap for `@solana/web3.js` `sendAndConfirm` when `SOLANA_RPC_URL` is set.

### 4.6 Parametric Vault (`src/vault/service.ts`)

- `getVault`: returns the singleton `Vault_State`, auto-resetting daily spend after 24h, creating the row if absent.
- `disburse`:
  1. Load cluster + votes; reject if already disbursed.
  2. Re-verify every signature; require `≥3 yes`.
  3. Derive capped amount (governor `effective`, else `TIER_CAPS[tier]`).
  4. Enforce daily + reserve caps.
  5. Pick recipient (explicit wallet → first verified NGO → deterministic mock).
  6. Mint tx signature + explorer URL, write `Disbursement_Txs`, debit vault, mark cluster `disbursed`.
- `getDisbursementHistory`: recent settlement records (optionally per cluster).

### 4.7 Brain Service (`brain_service/`)  ·  Python / FastAPI

- `POST /triage` — legacy triage (disaster type, urgency, location).
- `POST /swarm/verify` — supervisor endpoint mirroring the deterministic quorum; uses `USE_LLM_SWARM=1` + `OPENAI_API_KEY` for LLM-backed modes, else deterministic heuristics.
- `GET /health` — liveness.

### 4.8 Command Center (`frontend/`)  ·  Next.js 14 / Mapbox GL

| View | Implementation | Description |
|------|---------------|-------------|
| Live Map | `MapHeatmap.tsx` | Geo-clustered incidents; auto-fits to data bounds; urgency-scaled markers |
| Priority Sidebar | `PrioritySidebar.tsx` | Top-urgent verified alerts + sector filter |
| Swarm Panel | `SwarmPanel.tsx` | 4-agent debate: verdict, confidence, reasoning, signature, disbursement CTA |
| Audit View | `AuditView.tsx` | Full cluster trace: alerts → votes → disbursements → tx hashes |
| Vault State | `VaultState.tsx` | Reserve / daily limit / remaining + admin deposit |
| Command Center container | `CommandCenter.tsx` | Orchestrates panels, inject bar, responsive layout |

---

## 5. Data Flow (End-to-End)

```text
Raw report
   │
   ├─1─ validate + score + de-dupe ─► Quarantine? ─► Quarantine_Alerts
   │
   └─2─ persist Alert ─► cluster (1km/1h) ─► Incident_Cluster
                                   │
   ──3─ swarm verify (4 agents) ──► 3-of-4?
                                   │ yes                    │ no
                                   ▼                        ▼
   ──4─ vault disburse (caps) ──► Disbursement_Txs     audit_required
                                   │                        │
                                   ▼                        ▼
   ──5─ audit trail (replayable)                    re-verify / quarantine
```

---

## 6. Runtime Services & Ports

| Service | Host:Port | Notes |
|---------|-----------|-------|
| PostgreSQL + PostGIS | `localhost:5444` (docker `db`) | Container name `aegis-postgis` |
| Brain Service (FastAPI) | `localhost:8001` | `uvicorn app.main:app` |
| Command Center (Next.js) | `localhost:3000` | `npm run frontend:dev` |

---

## 7. Environment Configuration

### 7.1 Root `.env`

```bash
DATABASE_URL="postgresql://aegis:aegis_dev_password@localhost:5444/aegis?schema=public"
```

### 7.2 Frontend `.env.local`

```bash
DATABASE_URL="postgresql://aegis:aegis_dev_password@localhost:5444/aegis?schema=public"
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN="your_mapbox_public_token"
```

### 7.3 Brain Service (optional)

```bash
OPENAI_API_KEY="your_openai_api_key"   # for LLM swarm mode
USE_LLM_SWARM=1                        # enable LLM-backed agents
```

### 7.4 Agent signing secrets (optional)

```bash
AGENT_TRIANGULATOR_SECRET=...
AGENT_FACT_CHECKER_SECRET=...
AGENT_TRIAGE_SECRET=...
AGENT_GOVERNOR_SECRET=...
```

---

## 8. Standard Startup Procedure

1. Install root deps and start the DB:
   ```bash
   npm install
   docker compose up -d
   npm run db:init
   ```
2. Generate the Prisma client:
   ```bash
   npm run prisma:generate
   ```
3. Start the Brain Service (optional):
   ```bash
   python3 -m venv brain_service/.venv
   . brain_service/.venv/bin/activate
   pip install -r brain_service/requirements.txt
   cd brain_service && uvicorn app.main:app --reload --port 8001
   ```
4. Start the Command Center:
   ```bash
   npm --prefix frontend install
   npm run frontend:dev
   ```

---

## 9. Monitoring & Health Checks

- Brain Service: `GET http://localhost:8001/health`
- Command Center data APIs: `/api/alerts/heatmap`, `/api/alerts/priority`, `/api/clusters`, `/api/vault/state`
- Database connectivity verified through successful API responses and ingestion writes.

---

## 10. Testing & Validation

```bash
# Root: Prisma validate + generate + tsc build + unit tests
npm test

# Brain Service: pytest
cd brain_service && pytest -q

# Frontend quality
npm run frontend:lint
npm run frontend:build
```

---

## 11. Deployment (Vercel + Supabase)

- The live demo runs on **Vercel**: <https://aegiswarm.vercel.app/>
- `vercel.json` configures root + frontend install, frontend build, and `frontend/.next` output.
- **Production requires a hosted Postgres** (Supabase) — Vercel cannot reach a local Docker DB.
- Provision schema by running `prisma/setup.sql` + `prisma/seed.sql` against the hosted pooler connection string.
- Set `DATABASE_URL` and `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` (and optionally `USE_LLM_SWARM=1`, `OPENAI_API_KEY`) as Vercel env vars.

---

## 12. Operational Safety Practices

1. Keep `verified_status` gating active; don't present unverified alerts as deployment-ready.
2. Automatically verify the **3-of-4 quorum** before any disbursement; never bypass signatures.
3. Review `Quarantine_Alerts` regularly for adversarial patterns.
4. Rotate API keys, DB credentials, and agent secrets on schedule.
5. Treat agent scores as decision support, not sole authority — human commanders retain final dispatch approval.
