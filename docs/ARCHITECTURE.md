# AEGIS — Architecture Walkthrough

This document explains *how* AEGIS works under the hood — the design decisions, the multi-agent consensus protocol, the cryptographic verification, and the settlement path. It is written for engineers and judges who want to understand the system's internals, not just its output.

> Companion docs: [`README.md`](../README.md) (overview), [`SYSTEM_MANUAL.md`](../SYSTEM_MANUAL.md) (ops), [`API_REFERENCE.openapi.yaml`](../API_REFERENCE.openapi.yaml) (contracts).

---

## 1. Design Principles

| Principle | Where It Lives | Why |
|-----------|----------------|-----|
| **Decentralized consensus** | 3-of-4 quorum | No single model decides; three specialists must agree before money moves. |
| **Independent agents** | Synchronous parallel votes, no mid-run messaging | A quorum is only meaningful if each vote is independent. |
| **Defense in depth** | Zod validation → credibility → quarantine → quorum → caps | Every gate is belt-and-suspenders. |
| **Fail-safe defaults** | Risk Governor caps, 0-by-default payout | The system errs toward *not* spending. |
| **Deterministic & replayable** | HMAC signatures, quorum hash, persisted audit | Anyone can reconstruct why a decision was made. |
| **Location-agnostic** | Haversine clustering, auto-fit map | Global by design — no geo hardcoding. |

---

## 2. The Multi-Agent Quorum Protocol

### 2.1 Why Four Agents (and not one)

A single-agent GPT-style call cannot be trusted to move emergency funding: it can hallucinate, be misled by adversarial inputs, or be swayed by ambiguous text. AEGIS splits the decision into **four orthogonal concerns**, each with a distinct tool:

```text
              ┌────────────────────────────────────────────┐
              │            Same cluster snapshot           │
              └───────┬─────────┬─────────┬─────────┬──────┘
                      ▼         ▼         ▼         ▼
              ┌──────────┐ ┌────────┐ ┌────────┐ ┌──────────┐
              │ Triangle │ │ Fact-  │ │ Triage │ │  Risk    │
              │  -later  │ │ Checker│ │ Evalu- │ │Governor  │
              │          │ │        │ │ ator   │ │          │
              └────┬─────┘ └───┬────┘ └───┬────┘ └────┬─────┘
                   │           │          │           │
   concern:    GEOLOCATION  SOURCE     SEVERITY    SPENDING
                TRUST      CREDIBILITY / LOSS       SAFETY
```

- **Triangulator** — geolocation corroboration. Multiple independent reports pointing at the same place is a strong signal; one lone claim is not.
- **Fact-Checker** — source credibility. A WHO alert outranks an anonymous tip; low-credibility sources vote against action.
- **Triage Evaluator** — severity/loss. Converts urgency (1–5) into a tier and a proposed funding amount.
- **Risk Governor** — the brake. The other three are *advocates* for action; this one applies the caps and can veto.

### 2.2 The Orchestrator

`src/swarm/orchestrator.ts` — `runSwarmQuorum(input)`:

```text
1. triage = triageEvaluatorAgent(input)          # derive tier + amount
2. [triangulator, factChecker, governor] =       # run in PARALLEL
     await Promise.all([...])
3. votes = [triangulator, factChecker, triage, governor]
4. yesCount = votes.filter(v => v.vote === "yes").length
5. quorumReached = yesCount >= 3
6. cappedAmountUSD = governor.toolProofs.effective
7. status:
     quorumReached && cappedAmount > 0  -> "verified"
     noCount >= 2                        -> "quarantined"
     else                                -> "audit_required"
8. quorumHash = quorumHash(sorted signatures)
```

**Key design point:** triage runs first (it feeds `tier`/`amount` into the governor), but the other three run **concurrently**. This keeps latency to roughly one triage call + one parallel fan-out.

### 2.3 Vote Shape

Every agent returns:

```ts
{
  agentType,   // triangulator | fact_checker | triage_evaluator | risk_governor
  vote,        // "yes" | "no" | "abstain"
  score,       // 0..1 confidence
  reasoning,   // human-readable justification (shown in the UI)
  signature,   // HMAC-SHA256 hex over agentType:clusterId:vote:score
  toolProofs,  // raw numbers behind the verdict (tier, effective, credibility…)
}
```

---

## 3. Cryptographic Integrity

### 3.1 Signing (`src/swarm/crypto.ts`)

- `signVote(agentType, clusterId, vote, score)` → `HMAC-SHA256(secret, "agentType:clusterId:vote:score")`
- Per-agent secrets from env (`AGENT_*_SECRET`), with deterministic defaults for dev.
- **Mock ed25519** by design — the exact same *payload* is signed so `verifyVote` can recompute it. Swap the secrets/HMAC for a real ed25519 flow (e.g. `@noble/ed25519`) when moving on-chain; the byte-signature swap is isolated in one module.

### 3.2 Quorum Hash

The orchestrator computes a **tamper-evident fingerprint** of the approving votes:

```ts
quorumHash = SHA256( sort([triangulator, fact_checker, triage, governor])
                       .map(v => `${v.agentType}:${v.vote}:${v.signature.slice(0,16)}`)
                       .join("|") )
```

The sort makes the hash **order-independent** — the same set of votes always produces the same hash, so it's a stable, verifiable identity for "who approved this."

### 3.3 Re-verification at Settlement

The vault **does not trust** the agent votes it receives. In `disburse()` it re-runs `verifyVote` on every signature and rejects the request if fewer than 3 verify to `yes`. This prevents a caller from forging a "verified" cluster without valid signatures.

### 3.4 Mock Transaction Signature

`mockTxSignature(clusterId, quorumHash, amountUSD)` → `SHA256(clusterId:quorumHash:amount:time)`. This is a **stand-in for an on-chain Solana tx signature**. The explorer URL `https://explorer.sonic.game/tx/{sig}?cluster=devnet` makes it look/act real for the demo. When `SOLANA_RPC_URL` is present, swap this for a real `@solana/web3.js` `sendAndConfirm` — the change is isolated to this module.

---

## 4. Parametric Settlement (Pillar 3)

`src/vault/service.ts` — `disburse(prisma, { clusterId, votes, recipientWallet? })`:

```text
load cluster + votes ─► rejected if status === "disbursed"
        │
        ├─ verify every signature ─► reject if <3 valid yes
        │
        ├─ amountUSD = governor.effective  (fallback TIER_CAPS[tier])
        │        └─ reject if amountUSD <= 0
        │
        ├─ caps:  amountUSD > remainingDaily? reject
        │         amountUSD > reserve*0.1?  reject
        │         amountUSD > reserve?      reject
        │
        ├─ recipient = explicit wallet ─► first verified NGO ─► mock
        │
        ├─ mint txSignature + explorer URL
        │
        └─ write Disbursement_Txs
            debit reserve, increment disbursedToday
            mark cluster "disbursed"
```

### 4.1 Tier Cap Table

| Tier | Severity | Hard Cap |
|------|----------|----------|
| 1 | Monitor | $0 |
| 2 | Moderate | $5,000 |
| 3 | High | $15,000 |
| 4 | Catastrophic | $25,000 |

---

## 5. Geo-Clustering (Pillar 1)

`src/ingestion/cluster.ts`:

```text
report (lat, lon)
   │
   └─ compute haversine distance to every cluster created in last 60min
        ├─ any ≤ 1000m?  ─► merge (recompute centroid + radius)
        └─ none?        ─► create new cluster (radius 50m, count 1)
```

- **1 km / 1 hour** window = one incident isn't fragmented into ten alerts.
- Moving centroid keeps the cluster's position accurate as reports accumulate.
- **Location-agnostic** — Haversine works identically at any coordinates (fixed in [`global`](https://github.com/therealjhay/AegisAI) commit `64d0924`).

---

## 6. Data Model

```text
Alert ────────(cluster_id FK)────────► Incident_Cluster
                                           │
                                           ├──< Agent_Vote        (cluster_id FK, cascade)
                                           ├──< Disbursement_Tx   (cluster_id FK, cascade)
                                           │        (quorum_hash, tx_signature, amount_usd)
                                           │
                                           └── status lifecycle:
                                               pending → verified → disbursed
                                               pending → audit_required
                                               pending → quarantined
```

`Vault_State` is a singleton row (`id="singleton"`) tracking `reserve_usd`, `daily_limit_usd`, `disbursed_today_usd`, auto-reset every 24h.

---

## 7. Directory Layout

```text
AegisAI/
├─ prisma/
│  ├─ schema.prisma        # V2: all 7 tables
│  ├─ setup.sql            # PostGIS + tables DDL (Supabase bootstrap)
│  ├─ seed.sql             # worldwide demo incidents
│  └─ init.sql             # indexes + check constraints
├─ src/
│  ├─ ingestion/           # Pillar 1: validate, cluster, osint mocks
│  ├─ swarm/               # Pillar 2: 4 agents + orchestrator + crypto
│  └─ vault/service.ts     # Pillar 3: settlement
├─ brain_service/
│  └─ app/main.py          # FastAPI: /triage, /swarm/verify, /health
├─ frontend/
│  ├─ app/                 # Next.js pages + /api/* route handlers
│  ├─ components/          # CommandCenter, MapHeatmap, SwarmPanel, AuditView…
│  └─ lib/                 # db pool, swarm mirror, alerts
├─ docs/                   # this repo's deep-dive docs
├─ API_REFERENCE.openapi.yaml
├─ vercel.json             # Vercel build/deploy config
└─ docker-compose.yml      # PostGIS 16
```

---

## 8. Deployment Topology

```text
┌────────────────────────── Vercel (serverless) ──────────────────────────┐
│  Next.js 14 → /api/* route handlers (pg Pool)                          │
│  ── LANDS on ──►  Supabase Postgres (hosted pooler, ssl)                │
│                                 ▲                                       │
│                                 │ DATABASE_URL                          │
└────────────────────────────────────────────────────────────────────────┘
```

- **Vercel** cannot reach a local Docker DB → production uses **Supabase** pooling.
- `vercel.json` drives install/build/output so the root `src/` + `frontend/` monorepo builds on one Vercel project.
- Frontend `lib/swarm.ts` mirrors the swarm because Vercel can't cross-import between root `src/` and `frontend/` — the logic is duplicated intentionally.

---

## 9. Failure Modes & Reassurance

| Concern | How AEGIS Handles It |
|---------|----------------------|
| One agent is wrong | Three others must independently agree; single disagreement can't pass quorum. |
| Forged approval | Signatures re-verified server-side at settlement; cluster is not trusted. |
| Adversarial fake reports | Zod validation + credibility + quarantine; unverified never drives dispatch. |
| Overspending | Tier cap + daily cap + reserve cap (all enforced). |
| No funding left | `amountUSD > reserve` or daily-limit breach → rejects the disbursement. |
| Duplicate noise | 1km/1h clustering collapses duplicates into one cluster. |
