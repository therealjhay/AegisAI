<p align="center">
  <img src="./logo.png" alt="AEGIS" width="180" />
</p>

<h1 align="center">AEGIS</h1>

<p align="center">
  <strong>Decentralized Autonomous Disaster Response &amp; Parametric Micro-Grants Dispatcher</strong>
</p>

<p align="center">
  <em>Fast. Verified. Capped. Auditable.</em>
</p>

<p align="center">
  <a href="https://aegiswarm.vercel.app/"><strong>Live Demo →</strong></a>
</p>

---

## What is AEGIS?

AEGIS is a **real-time disaster response command center** that converts raw, noisy field signals into **verified, funded humanitarian aid** — automatically. It listens to emergency reports (SMS, social media, NGO partner feeds, weather alerts), clusters them into geographic incident zones, and then runs a **multi-agent verification swarm** that decides — with cryptographic consensus — whether an incident is real, how severe it is, and whether emergency micro-grants should be released.

Think of it as an **autonomous crisis coordinator** sitting between *"the ground is reporting something"* and *"help actually gets deployed."* It removes the slow, opaque human bottleneck from the critical path — while keeping every decision fully auditable.

## Why It Matters

Disaster response is broken by three problems:

| Problem | Consequence |
|---------|-------------|
| **Latency** | Reports arrive in seconds, but human triage + funding takes *days*. |
| **Noise** | The signal-to-noise ratio is brutal; fake/duplicate reports flood in. |
| **Opacity** | When money deploys, nobody can cleanly answer *"why was this funded?"* |

AEGIS compresses the pipeline from **"report in" → "funds out"** into seconds, while adding **verification**, **spending limits**, and **cryptographic auditability** at every step.

---

## The Four Pillars

AEGIS is built on four independent, composable pillars:

1. **OSINT Ingestion + Geo-Clustering** — group raw reports into `IncidentCluster`s by proximity (1&nbsp;km) and time, so one event isn't treated as ten.
2. **Multi-Agent Verification Quorum (3-of-4)** — four specialized agents vote on every incident; funding unlocks only when **at least 3 of 4 agree**.
3. **Parametric Vault Settlement** — approved incidents auto-release USD grants, hard-capped per incident, per day, and against a total reserve.
4. **Verifiable Audit Trail** — every vote is cryptographically signed; every disbursement carries a quorum hash + tx signature + explorer link.

---

## Architecture

### System Overview

```text
                        ┌────────────────────────────────────────────┐
                        │              INGESTION (TS)                │
   SMS ──┐              │  schema validation · source scoring ·      │
   Social┼──► Alerts ──►│  duplicate suppression · quarantine        │
   Partner├──► Feed     └───────────────┬────────────────────────────┘
   Weather┘                             │  raw_text, lat, lon, urgency
                                        ▼
                        ┌────────────────────────────────────────────┐
                        │        GEO-CLUSTERING (Pillar 1)           │
                        │  haversine 1km / 1h → IncidentCluster      │
                        └───────────────┬────────────────────────────┘
                                        ▼
                        ┌────────────────────────────────────────────┐
                        │   MULTI-AGENT QUORUM (Pillar 2)            │
                        │                                            │
                        │   Triangulator   Fact-Checker              │
                        │        │\               │                   │
                        │        │ \              │                   │
                        │        │  \             │                   │
                        │        ▼   ▼            ▼                   │
                        │        ORCHESTRATOR  (3-of-4 rule)         │
                        │        │                                    │
                        │   Triage Evaluator  Risk Governor ──► cap   │
                        │                                            │
                        └───────────────┬────────────────────────────┘
                                        │  ≥3 YES  →  verified
                                        ▼
                        ┌────────────────────────────────────────────┐
                        │  PARAMETRIC VAULT (Pillar 3)               │
                        │  verify 3 sigs · apply caps · mint tx      │
                        └───────────────┬────────────────────────────┘
                                        │
                                        ▼
                        ┌────────────────────────────────────────────┐
                        │   COMMAND CENTER (Next.js + Mapbox)        │
                        │   map heatmap · swarm panel · audit view · │
                        │   vault state · inject bar                  │
                        └────────────────────────────────────────────┘
```

### Data Flow (end-to-end)

```text
[Raw report] → 1. Ingest & validate  → 2. Cluster (1km/1h)
                                  │
                                  ▼
            3. Swarm votes (4 agents) ── 3-of-4?
                                  │ yes                    │ no
                                  ▼                        ▼
            4. Vault: verify sigs, apply caps       audit_required
                                  │                        │
                                  ▼                        ▼
            5. Disburse (signed tx)              re-verify / quarantine
                                  │
                                  ▼
            6. Audit trail (replayable) → Command Center UI
```

### Component Breakdown

| Component | Stack | Responsibility |
|-----------|-------|----------------|
| **Ingestion** (`src/ingestion/`) | TypeScript, Zod, `pg` | Validate, de-duplicate, score sources, route to quarantine. |
| **Geo-Clustering** (`src/ingestion/cluster.ts`) | Haversine math | Group reports into `IncidentCluster`s by proximity + recency. |
| **Multi-Agent Swarm** (`src/swarm/`) | TypeScript (deterministic) | Four agents + orchestrator implementing the 3-of-4 quorum. |
| **Parametric Vault** (`src/vault/service.ts`) | TypeScript, Prisma | Signature verification, spending caps, disbursement writing. |
| **Brain Service** (`brain_service/`) | Python, FastAPI | `/triage` (legacy) + `/swarm/verify` (supervisor) deterministic or LLM-backed. |
| **Command Center** (`frontend/`) | Next.js 14, Mapbox GL, framer-motion | Operational UI: map, swarm panel, audit view, vault state. |
| **Database** | PostgreSQL 16 + PostGIS, Prisma | `Alerts`, `IncidentCluster`, `AgentVote`, `DisbursementTx`, `VaultState`, `NGOUser`. |

---

## The Multi-Agent System

AEGIS is a **multi-agent system**, not a single-agent application, because **no single model should decide who receives emergency aid**. It is a *quorum*, not one opinion.

### The Four Agents

| Agent | Role | Key Question It Answers |
|-------|------|------------------------|
| **Triangulator** `📍` | Geolocation corroboration | *Is this where multiple independent reports all point?* |
| **Fact-Checker** `🔍` | Source credibility | *Can we trust who is telling us this?* |
| **Triage Evaluator** `📊` | Severity / loss scoring | *How many lives are at risk, and how bad is it?* |
| **Risk Governor** `🛡️` | Spending cap / veto | *Is it safe to fund, and how much?* |

### How They Coordinate

```text
        SAME incident snapshot (shared state, no mid-run messaging)
        ┌────────────┬────────────┬──────────────┬──────────────┐
        │ Triangulator│ Fact-Checker│ Triage Eval │ Risk Governor│
        └─────┬──────┴─────┬──────┴──────┬───────┴──────┬───────┘
              │             │             │              │
              ▼             ▼             ▼              ▼
          yes/no    yes/no               yes/no       yes/no/abstain
          +score     +score              +score        +score
          +reason    +reason             +reason       +reason
          +signed    +signed             +signed       +signed
              │             │             │              │
              └─────────────┴──────┬──────┴──────────────┘
                                  ▼
                        ┌──────────────────────┐
                        │   ORCHESTRATOR       │
                        │  ≥3 yes → VERIFIED   │
                        │  governor cap = pay  │
                        │  quorumHash = signed │
                        └──────────────────────┘
```

- **Independence, not debate:** agents **don't message each other**. Each reads the same cluster snapshot and votes alone. This is deliberate — a quorum only holds value if each check is independent.
- **Coordination by shared state:** the swarm writes votes + quorum hash to the cluster record. The **vault reads that record** to settle. No direct agent-to-vault calls.
- **Deterministic and replayable:** every vote is signed and persisted, so anyone can reconstruct *why* a decision was made.

### Signature & Quorum Hash

Each vote is signed with an **HMAC-SHA256** secret (mock ed25519; swappable for real Solana ed25519). The orchestrator computes a **quorum hash** over the sorted signatures — a cryptographic fingerprint of the exact set of votes that authorized a disbursement.

---

## The Parametric Vault

Disbursements are **risk-gated** by three independent caps (enforced in `src/vault/service.ts`):

1. **Per-incident cap** — tier-based: `T1: $0 · T2: $5k · T3: $15k · T4: $25k`
2. **Daily cap** — released against a daily limit (`$100k` default)
3. **Reserve cap** — never disburse more than the vault can back

A disbursement requires:
- `≥3` valid agent signatures (re-verified server-side at disbursement time)
- a non-zero governor-capped amount
- available daily + reserve headroom

On success, a **mock transaction signature** is minted (deterministic hash; swap for `@solana/web3.js` `sendAndConfirm` when `SOLANA_RPC_URL` is present) and an explorer link is recorded.

---

## The Command Center UI

The live operator surface (`frontend/`) is where the pillars come together:

| Panel | What It Shows |
|-------|---------------|
| **Live Map** | Geo-clustered incidents with urgency-based sizing/color. Auto-fits to data (location-agnostic). |
| **Priority Sidebar** | Top-urgent verified alerts, sector filterable. |
| **Swarm Debate Panel** | All 4 agent votes — verdict, confidence, reasoning, signature. |
| **Audit View** | Full cluster history: alerts → votes → disbursements → tx signatures. |
| **Vault State** | Reserve, daily limit, remaining today + admin deposit. |
| **Inject Bar** | Type a report → ingest → cluster → swarm panel opens live. |

---

## API Surface

### Brain Service (FastAPI)
| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Service health check |
| `POST` | `/triage` | Legacy triage: disaster type, urgency, location extraction |
| `POST` | `/swarm/verify` | Run the deterministic 3-of-4 quorum on a cluster |
| `GET` | `/swarm/quorum` | Fetch stored votes + quorum for a cluster |

### Command Center (Next.js route handlers)
| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/ingest` | Ingest & cluster a raw report |
| `POST` | `/api/swarm/verify` | Run swarm verification (clusterId or raw_text) |
| `POST` | `/api/vault/disburse` | Verify signatures → disburse grant |
| `GET` | `/api/vault/state` | Vault state + admin deposit |
| `GET` | `/api/audit/[clusterId]` | Full audit trail for a cluster |
| `GET` | `/api/clusters` | List incident clusters |
| `GET` | `/api/disbursements` | Disbursement history |
| `GET` | `/api/alerts/priority` | Top-urgent verified alerts |
| `GET` | `/api/alerts/heatmap` | Heatmap point data |
| `GET` | `/api/sectors` | Available sector filters |

Full contract: [`API_REFERENCE.openapi.yaml`](./API_REFERENCE.openapi.yaml). Interactive docs at `http://localhost:8001/docs` when the Brain Service is running.

---

## Data Model

```text
Alert ────┐
          │  cluster_id (FK)
          ▼
Incident_Cluster ──< Agent_Vote        (cluster_id FK, onDelete cascade)
       │            ──< Disbursement_Tx (cluster_id FK, onDelete cascade)
       │
Vault_State (singleton row: reserve, daily_limit, disbursed_today)

NGO_User (organization, sector, wallet_address, is_verified)
```

Relations: one `IncidentCluster` has many `AgentVote`s and many `DisbursementTx`s, and optionally groups many `Alert`s. All new Pillar tables are in [`prisma/schema.prisma`](./prisma/schema.prisma) and bootstrapped by [`prisma/setup.sql`](./prisma/setup.sql).

---

## Getting Started

### Prerequisites
- Node.js ≥ 20
- Docker (for local PostGIS)
- Python ≥ 3.11 (for the Brain Service)
- A Mapbox public token (`NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`)

### 1. Clone & install

```bash
git clone https://github.com/therealjhay/AegisAI.git
cd AegisAI
npm install
```

### 2. Start the database (local PostGIS)

```bash
docker compose up -d
npm run db:init
```

### 3. Configure environment

`frontend/.env.local`:
```bash
DATABASE_URL="postgresql://aegis:aegis_dev_password@localhost:5444/aegis?schema=public"
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN="your_mapbox_public_token"
```

> For the hosted Supabase demo, point `DATABASE_URL` at your Supabase pooler connection string and run [`prisma/setup.sql`](./prisma/setup.sql) + [`prisma/seed.sql`](./prisma/seed.sql) against it.

### 4. Seed demo data (optional)

```bash
psql "$DATABASE_URL" -f prisma/setup.sql
psql "$DATABASE_URL" -f prisma/seed.sql
```

### 5. Start the Brain Service (optional)

```bash
python3 -m venv brain_service/.venv
. brain_service/.venv/bin/activate
pip install -r brain_service/requirements.txt
cd brain_service && uvicorn app.main:app --reload --port 8001
```

### 6. Run the Command Center

```bash
npm run frontend:dev
```

Open `http://localhost:3000`.

---

## Testing

```bash
# TypeScript validation + unit tests + build
npm test

# Brain Service
cd brain_service && pytest -q

# Frontend quality
npm run frontend:lint
npm run frontend:build
```

---

## Deployment

The current live demo is deployed on **Vercel**: <https://aegiswarm.vercel.app/>

- **Build config:** `vercel.json` (`installCommand` installs root + frontend deps; `buildCommand` runs the frontend build; `outputDirectory: frontend/.next`).
- **Production database:** Supabase Postgres (the demo's `DATABASE_URL` points to a hosted pooler). Vercel cannot reach a local Docker DB — a hosted Postgres is required in production.
- **Env vars on Vercel:** `DATABASE_URL`, `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` (and optionally `USE_LLM_SWARM=1`, `OPENAI_API_KEY`).

---

## In One Sentence

**AEGIS turns raw disaster signals into verified, capped, and auditable humanitarian funding — using a 3-of-4 agent quorum to decide, so aid moves fast without ever being reckless.**

---

## Related Documentation

- [`SYSTEM_MANUAL.md`](./SYSTEM_MANUAL.md) — comprehensive architecture + operations manual
- [`SECURITY.md`](./SECURITY.md) — threat model + hardening + anti-honey-pot safeguards
- [`DISASTER_RECOVERY.md`](./DISASTER_RECOVERY.md) — outage recovery + redeployment runbook
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — deep architecture walkthrough
- [`DEMO.md`](./DEMO.md) — judge walkthrough / demo script
- [`API_REFERENCE.openapi.yaml`](./API_REFERENCE.openapi.yaml) — full API contract

## License

MIT
