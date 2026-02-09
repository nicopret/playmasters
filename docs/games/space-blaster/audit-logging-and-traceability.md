# Space Blaster Audit Logging & Traceability Specification

## 1. Purpose

Space Blaster is a competitive arcade game operating in a live environment with data-driven configuration. To maintain:

* Competitive integrity
* Operational safety
* Reproducibility of issues
* Governance and accountability

The system must maintain a complete audit trail of:

* Configuration publishes
* Validation failures
* Version pointer updates
* Rollbacks
* Score submissions

This document defines mandatory logging and traceability requirements.

---

# 2. Core Traceability Model

All runtime activity must be traceable back to:

```
environment + bundleId + configHash
```

All administrative actions must be traceable to:

```
actorId + timestamp + environment + actionType
```

---

# 3. Audit Events (Authoritative List)

## 3.1 Publish Attempt

Triggered when Admin initiates a publish.

Log fields:

```json
{
  "eventType": "publish_attempt",
  "environment": "staging",
  "actorId": "admin_123",
  "timestamp": "...",
  "artifactIds": {
    "gameConfigId": "...",
    "levelSetId": "...",
    "enemyCatalogId": "...",
    "heroCatalogId": "...",
    "scoreConfigId": "..."
  }
}
```

---

## 3.2 Publish Validation Result

Logged after validation pipeline completes.

### On Failure

```json
{
  "eventType": "publish_failed",
  "environment": "staging",
  "actorId": "admin_123",
  "timestamp": "...",
  "errors": [
    {
      "stage": "cross-reference",
      "domain": "LevelConfig",
      "sourceId": "level_3",
      "path": "waves[2].enemyId",
      "message": "Unknown enemyId 'enemy_striker_02'"
    }
  ]
}
```

### On Success

```json
{
  "eventType": "publish_succeeded",
  "environment": "staging",
  "actorId": "admin_123",
  "timestamp": "...",
  "bundleId": "sb_bundle_2025_01_15_01",
  "configHash": "sha256-abc123...",
  "artifactSnapshot": { ... }
}
```

---

## 3.3 Version Pointer Update

Logged whenever a pointer changes (including production promotion).

```json
{
  "eventType": "pointer_updated",
  "environment": "prod",
  "actorId": "admin_123",
  "timestamp": "...",
  "previousBundleId": "sb_bundle_01",
  "newBundleId": "sb_bundle_02"
}
```

Must be logged even if part of publish flow.

---

## 3.4 Rollback Event

Rollback is a pointer update with intent classification.

```json
{
  "eventType": "rollback",
  "environment": "prod",
  "actorId": "admin_456",
  "timestamp": "...",
  "fromBundleId": "sb_bundle_03",
  "toBundleId": "sb_bundle_01",
  "reason": "balance regression"
}
```

Rollback must not delete historical bundles.

---

## 3.5 Score Submission Event

Each score submission must log:

```json
{
  "eventType": "score_submitted",
  "environment": "prod",
  "timestamp": "...",
  "playerId": "player_123",
  "score": 18750,
  "bundleId": "sb_bundle_03",
  "configHash": "sha256-abc123...",
  "stats": { ... }
}
```

This ensures:

* Score can be traced to exact config version
* Leaderboard anomalies can be investigated

---

# 4. Immutability & Retention Rules

* Published bundles must be immutable
* Audit logs must be append-only
* Audit logs must not be edited in place
* Retention period must meet platform governance policy

Rollback does not delete bundles or logs.

---

# 5. Traceability Requirements

The system must support answering the following questions:

1. Which config version was active when a given score was submitted?
2. Who published the config that introduced a balance change?
3. When was a rollback performed and why?
4. Which validation errors prevented a publish?
5. Which artifact versions were included in a given bundle?

If the system cannot answer these, the audit model is incomplete.

---

# 6. Correlation IDs

Recommended: include a correlationId in:

* Publish attempts
* Validation results
* Pointer updates

This allows tracing a publish attempt across logs.

Example:

```json
{
  "correlationId": "publish-2025-01-15-abc123"
}
```

---

# 7. Admin UI Requirements

Admin UI should display:

* Publish history (with timestamps and actors)
* Bundle history (bundleId + configHash)
* Rollback history
* Validation error logs

Production publish and rollback actions should require explicit confirmation.

---

# 8. Runtime Logging Requirements

The game runtime must:

* Store configHash in RunContext
* Include configHash in score submission
* Log submission failures with configHash
* Not log sensitive PII in gameplay telemetry

---

# 9. Security & Integrity Considerations

* Only authorized actors may publish to production
* Rollback must require equivalent or higher permission
* Audit logs must be tamper-resistant
* configHash must not be modifiable by client runtime

---
