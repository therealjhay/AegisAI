# AEGIS — Demo Script & Judge Walkthrough

A guided tour of AEGIS from first report to funded, auditable response. Use this to run the live demo (<https://aegiswarm.vercel.app/>) or a local instance.

---

## 0. Before You Start

- **Live:** <https://aegiswarm.vercel.app/> — the deployed frontend.
- **Bottom-left inject bar:** the fastest way to trigger the full pipeline on demand.
- The map **auto-fits to the data** — it is not centered on one country.
- Every number you see (tier, cap, quorum hash, tx signature) is real and traceable.

---

## 1. The Problem Takes 60 Seconds

> *"Disaster response today is slow, noisy, and opaque. Reports arrive in seconds, but funding decisions take days. And when money moves, nobody can cleanly say why."*

Point at the three pain points on the landing page:
1. **Latency** — days, not seconds.
2. **Noise** — fake/duplicate reports flood in.
3. **Opacity** — no clean answer to "why was this funded?"

---

## 2. Command Center — The Live Surface

Show the operation map (live heatmap of real incidents):

- **Cluster sizes** grow with report count.
- **Colors** encode urgency (safe → warning → critical).
- **Auto-fit** — the camera frames wherever real data is, worldwide.

Name the right-hand panels you'll use:
- **Swarm Panel** — where four agents debate the incident.
- **Audit View** — the crypto-verifiable history of a decision.
- **Vault State** — the funding reservoir and caps.

---

## 3. Inject a Report (the fast path)

Use the **inject bar** (bottom-left) to type a report. Two demo flavors:

**Flood (verifiable → funds release):**
> `Flood waters are rising fast, families trapped on rooftops near the river market.`

**Armed attack (high tier → release):**
> `Armed group ambush reported near the main supply road, medical team taking cover.`

Watch the pipeline run live:
1. **Ingest** — the report validates, is de-duplicated, and is geolocated.
2. **Cluster** — it joins (or creates) an `IncidentCluster`.
3. **Swarm debate** — the Swarm Panel opens and four agents vote.

---

## 4. The Multi-Agent Swarm — The Core Story

This is the part to slow down on. Show all **four agents** and their independent verdicts:

| Agent | What It Decided | Why (reasoning) |
|-------|-----------------|-----------------|
| **📍 Triangulator** | Geocorroboration | Do reports converge on one location? |
| **🔍 Fact-Checker** | Source credibility | Is this a trusted source? |
| **📊 Triage Evaluator** | Severity tier | Lives at risk, estimated loss. |
| **🛡️ Risk Governor** | Cap / veto | Is it safe, and how much? |

Emphasize the three properties that make this a **multi-agent (not single-agent) system**:
1. **Independent** — each agent reads the same snapshot, votes alone, and signs its verdict.
2. **Consensus** — funds unlock only when **≥3 of 4** independently say **yes**.
3. **Replayable** — every vote carries a `signature`; the orchestrator binds them into a `quorumHash`.

> *The three agents are advocates for action. The Risk Governor is the brake. Three of them have to agree before a single dollar moves.*

---

## 5. Verdict + Caps

Show the verdict banner:
- **VERIFIED** — quorum reached.
- **Tier** — the severity grade.
- **Capped amount** — what the Risk Governor allowed (not what the Triage Evaluator asked for).

Note the cap table keeps money from being reckless:

| Tier | Hard Cap |
|------|----------|
| 1 | $0 |
| 2 | $5,000 |
| 3 | $15,000 |
| 4 | $25,000 |

---

## 6. Disburse — Money Moves With Proof

Hit **⚡ Execute Disbursement**. Show:
1. **Signatures re-verified server-side** (the vault doesn't trust the client).
2. **Caps enforced** (daily + reserve).
3. **Tx signature** minted + **explorer link** recorded.

Explain the mock-chain swap: today it's a deterministic `SHA256` signature for the demo; the module is isolated so `@solana/web3.js` `sendAndConfirm` can drop in when `SOLANA_RPC_URL` is present.

---

## 7. Audit View — Prove Accountability

Switch to **Audit** for the same cluster. Show:
- the alerts that fed the cluster,
- all four votes with signatures,
- the disbursements with `quorum_hash` + `tx_signature`,
- the exact data needed to answer *"why was this funded, by whom, for how much?"*

> *Every dollar is traceable back to the exact set of signed votes that authorized it.*

---

## 8. Vault State — The Guardrails

Show **Vault State**:
- **Reserve** (e.g. $1,000,000 default)
- **Daily limit** (e.g. $100,000)
- **Remaining today** — decreases as you disburse

Note the auto-reset after 24h and that it's a **singleton** row.

---

## 9. Edge Cases (if the judges probe)

| Probe | Intended Answer |
|-------|-----------------|
| "What if one agent is wrong?" | Three must agree; one disagreement can't pass quorum. |
| "What if someone forges an approval?" | Signatures re-verified at settlement; cluster not trusted. |
| "What about fake reports?" | Zod validation + credibility + quarantine; unverified never drives dispatch. |
| "Could it overspend?" | Tier + daily + reserve caps all enforced; `0` default. |
| "Is it location-locked?" | No — clustering + map auto-fit are global. |

---

## 10. Close The Pitch

> *"AEGIS compresses 'report in → funds out' from days to seconds — with verification, spending caps, and cryptographic auditability at every step. It's a disaster response coordinator that's fast, safe, and provably accountable."*

---

## Demo Props / Fallbacks

- **No internet / Mapbox token missing:** the app degrades to a **List-Only Mode** (priority sidebar + alerts) so the workflow is still demonstrable.
- **Quorum fails (noise report):** show the charting to `audit_required` / quarantine outcome — the system correctly refuses to fund bad data. 

---

## Quick Reference

| Concept | Where to find it |
|---------|------------------|
| Overview | `README.md` |
| Internals | `docs/ARCHITECTURE.md` |
| Operations | `SYSTEM_MANUAL.md` |
| API contracts | `API_REFERENCE.openapi.yaml` |
| Security | `SECURITY.md` |
