# AEGIS — Security & Threat Model

AEGIS is designed for **humanitarian triage**, not offensive surveillance. Security priorities: prevent data abuse, reduce adversarial manipulation, and block misuse as a honey-pot / social-engineering vector. Because AEGIS also **moves money**, settlement integrity and spoofing resistance are first-class concerns.

---

## 1. Threat Model

### Primary — Mission-Critical Threats

| Threat | Impact | Class |
|--------|--------|-------|
| **Authentic Funding Bypass** | A fabricated incident verifies and receives a real disbursement. | Integrity |
| **Signature Forgery** | A caller forges a `verified` cluster without valid agent signatures. | Integrity |
| **Disbursement Replay / Doubt** | Same cluster paid more than once, or amount altered after approval. | Integrity |
| **Adversarial Signal Injection** | Fake reports lure responders into traps or map NGO movement. | Safety / Privacy |

### Secondary

- **Data poisoning** — degrade urgency ranking / trust in verification.
- **Overspending** — caps bypassed → funds exhausted unsafely.
- **Infrastructure compromise** — alter alerts, votes, or operational views.
- **Unauthorized data extraction** — incident/response pattern mapping.

---

## 2. Mitigations Implemented

### 2.1 Verification Gate Before Persistence (Pillar 1)

The ingestion service validates, scores source credibility, de-duplicates (1km/1h), and quarantines before writing to `Alerts`:

1. Zod schema validation.
2. Source credibility scoring.
3. Duplicate suppression (1 km / 1 hour window).
4. Quarantine routing for suspicious payloads.

Result: low-trust or malformed payloads do not enter the primary dataset.

### 2.2 Quarantine Audit Trail

Suspicious payloads persist in `Quarantine_Alerts` with reason codes, structured details, and an immutable timestamp. Analysts can investigate adversarial campaigns without contaminating the live map.

### 2.3 Verified-Alert Gating in the UI

Command Center APIs and views restrict to `verified_status = true`. Unverified data cannot automatically drive field dispatch.

### 2.4 Multi-Agent Consensus (Pillar 2)

- **No single-agent decision.** A fabricated or misleading signal must fool **3 of 4 independent specialists** to pass.
- **Independent votes.** Agents do not message each other mid-run, so one confident agent can't sway the rest.
- **Failure default.** The Risk Governor defaults to `abstain`/reject under cap stress — the system errs toward **not** spending.

### 2.5 Cryptographic Settlement Integrity (Pillar 3)

- **Signed votes.** Every vote is HMAC-signed over `agentType:clusterId:vote:score`.
- **Server-side re-verification.** The vault `verifyVote`s every signature and rejects the cluster if fewer than **3 valid yes**.
- **Tamper-evident quorum hash.** `SHA256` over *sorted* `agentType:vote:signature[:16]` — order-independent, cannot be silently altered.
- **Idempotent settlement.** A cluster already marked `disbursed` is rejected; a second pay of the same cluster fails.
- **Bounded payout.** Amounts come from the governor's `effective` value (caps), not arbitrary client requests.

### 2.6 Defense-in-Depth on AI Output

Brain Service triage outputs are bounded and structured: urgency constrained to 1–5, normalized response shape, deterministic fallback when no LLM key is present.

### 2.7 Cap Stack (never reckless)

| Cap | Enforced In |
|-----|-------------|
| Tier / per-incident | `TIER_CAPS` + governor `effective` |
| Daily | `amountUSD > remainingDaily` → reject |
| Reserve | `> 10% reserve` or `> reserve` → reject |

---

## 3. Honey-Pot Misuse Mitigation

To reduce the risk of luring responders into traps:

1. **Do not auto-deploy from a single alert** — require multi-source confirmation or trusted human verification.
2. **Correlate with independent channels** — partner NGOs, public advisories, local authority feeds.
3. **Treat geolocation as advisory until verified** — especially for first-time or low-credibility sources.
4. **Human approval for high-risk missions** — AI ranking supports; it does not replace commander authorization.
5. **Review quarantine trends daily** — repeated-source bursts should trigger source blocking.

---

## 4. Production Security Controls (Required)

### Access Control
- Restrict DB and APIs to private networks/VPN where possible.
- Role-based access for operators, analysts, admins; least privilege on DB credentials.

### Secret Management
- Store `DATABASE_URL`, `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, `OPENAI_API_KEY`, agent signing secrets in a secrets manager / env injection.
- Never commit secrets to git. Rotate on schedule and after exposure.

### Transport Security
- TLS termination at the reverse proxy / load balancer; HTTPS-only for all operator endpoints.

### Observability & Detection
- Log auth events, API failures, anomaly spikes.
- Alert on unusual bursts of similar alerts or repeated source patterns.
- Track quarantine reasons by source and geography.

### Data Governance
- Minimize retained sensitive fields.
- Restrict export access for incident raw text and precise coordinates.
- Define a retention policy for `Quarantine_Alerts` and logs.

---

## 5. Disbursement Integrity Checklist (specific to wallet moves)

Before allowing a disbursement, confirm:

- [ ] Cluster exists and is not already `disbursed`.
- [ ] All provided vote signatures re-verify server-side.
- [ ] At least **3** signatures resolve to `yes`.
- [ ] The amount equals the governor's `effective` (capped) value.
- [ ] Daily remaining and reserve headroom are sufficient.
- [ ] Recipient is an explicit wallet OR a verified `NGO_User` OR the deterministic mock fallback.
- [ ] The disbursement writes a `tx_signature` + `explorer_url` for the audit trail.

---

## 6. Adversarial Scenario Playbook

**Coordinated fake-report campaign suspected:**
1. Freeze automated downstream actions (disbursement).
2. Tighten ingestion threshold (raise credibility bar).
3. Isolate suspicious sources; quarantine related payloads.
4. Notify field coordinators of deception risk.
5. Forensically review logs, payload patterns, access activity.
6. Rotate credentials and redeploy clean artifacts if compromise is suspected.

**Forged cluster / invalid signature received:**
1. Reject at settlement; log the failure.
2. Record the cluster under `audit_required`.
3. Investigate how the invalid signatures were produced.
4. Rotate agent secrets if a signing key is suspected compromised.

---

## 7. Secure Operations Checklist

**Before go-live:**
- [ ] `verified_status` gating enabled in all views.
- [ ] Secrets externalized and rotation scheduled.
- [ ] Backup/restore tested (see `DISASTER_RECOVERY.md`).
- [ ] Incident-response owner designated.
- [ ] Manual dispatch-approval policy documented and enforced.

**During operations:**
- [ ] Monitor quarantine rate + source anomalies.
- [ ] Recalibrate credibility thresholds as attack patterns change.
- [ ] Patch dependencies and the OS baseline regularly.
