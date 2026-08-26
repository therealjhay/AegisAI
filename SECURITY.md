# Security Hardening Guide

## Security Objective

AEGIS is designed for humanitarian triage, not offensive surveillance. The security model prioritizes preventing data abuse, reducing adversarial manipulation, and blocking system misuse as a "honey pot" for bad actors.

## Threat Model Focus

Primary misuse concern:

- A malicious actor injects fabricated alerts to attract responders into unsafe zones or to map NGO movement patterns.

Secondary concerns:

- Data poisoning to degrade trust in urgency ranking.
- Unauthorized data extraction of incident/response patterns.
- Infrastructure compromise to alter alerts or operational views.

## Mitigations Already Implemented

### 1. Verification Gate Before Persistence

The ingestion service enforces strict payload validation and verification before writing to `Alerts`:

1. Schema validation with Zod.
2. Source credibility scoring.
3. Duplicate suppression (1 km / 1 hour window).
4. Quarantine routing for suspicious payloads.

Result: low-trust or malformed payloads do not enter the primary operator dataset.

### 2. Quarantine Audit Trail

Suspicious payloads are stored in `Quarantine_Alerts` with:

- reason codes,
- structured details,
- immutable timestamp.

Result: analysts can investigate adversarial campaigns without contaminating live operational maps.

### 3. Verified Alert Gating in UI

Command Center APIs and UI use `verified_status = true` for priority/heatmap displays.

Result: unverified data cannot automatically drive field dispatch decisions.

### 4. Defense-in-Depth on AI Output

Brain service triage outputs are bounded and structured:

- urgency constrained to 1-5,
- normalized response shape,
- deterministic fallback when LLM key is unavailable.

Result: model behavior is constrained and less likely to produce unsafe free-form outputs.

## Honey-Pot Misuse Mitigation Strategy

To reduce risk of luring responders into traps:

1. **Do not auto-deploy from a single alert.**
   - Require multi-source confirmation or trusted human verification.
2. **Correlate with independent channels.**
   - Cross-check with partner NGOs, public advisories, or local authority feeds.
3. **Treat geolocation as advisory until verified.**
   - Especially for first-time or low-credibility sources.
4. **Require human approval workflow for high-risk missions.**
   - AI ranking supports decisions; it does not replace commander authorization.
5. **Review quarantine trends daily.**
   - Burst patterns from repeated sources should trigger source blocking.

## Production Security Controls (Required)

### Access Control

- Restrict database and APIs to private networks/VPN where possible.
- Use role-based access for operators, analysts, and administrators.
- Enforce least privilege on DB credentials.

### Secret Management

- Store keys (`OPENAI_API_KEY`, DB credentials, Mapbox token) in secret managers or environment-injection tooling.
- Never commit secrets to git.
- Rotate keys on schedule and after any suspected exposure.

### Transport Security

- TLS termination at reverse proxy/load balancer.
- HTTPS-only traffic for all operator endpoints.

### Observability & Detection

- Log authentication events, API failures, and anomaly spikes.
- Alert on unusual bursts of similar alerts or repeated source patterns.
- Track repeated quarantine reasons by source and geography.

### Data Governance

- Minimize retained sensitive fields.
- Restrict export access for incident raw text and precise coordinates.
- Define retention policy for `Quarantine_Alerts` and logs.

## Secure Operations Checklist

Before go-live:

1. Confirm `verified_status` gating is enabled in all operational views.
2. Confirm secrets are externalized and rotated.
3. Confirm backup/restore process is tested (see `DISASTER_RECOVERY.md`).
4. Confirm incident-response owner is designated.
5. Confirm manual dispatch approval policy is documented and enforced.

During operations:

1. Monitor quarantine rate and source anomalies.
2. Recalibrate credibility thresholds if attack patterns change.
3. Patch dependencies and OS baseline regularly.

## Incident Response (Abuse Scenario)

If coordinated malicious alert campaign is suspected:

1. Freeze automated downstream actions.
2. Temporarily tighten ingestion threshold (higher credibility requirement).
3. Isolate suspicious sources and quarantine all related payloads.
4. Notify field coordinators of potential deception risk.
5. Forensically review logs, payload patterns, and access activity.
6. Rotate credentials and redeploy clean artifacts if compromise is suspected.
