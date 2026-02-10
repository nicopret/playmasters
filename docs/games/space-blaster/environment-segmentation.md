# Space Blaster Environment Segmentation & Leaderboard Isolation

## 1. Purpose

Space Blaster is a competitive arcade game deployed on the Playmasters platform. To ensure safe iteration, stable production gameplay, and fair leaderboard integrity, configuration and scoring must be segmented across environments.

This document defines:

* Environment types
* How config publishing behaves per environment
* How leaderboards are isolated
* How environment + configHash interact
* What is required for safe production deployment

---

## 2. Environment Types

The platform supports at least three environments:

| Environment | Purpose                   | Publicly Visible | Leaderboard Type     |
| ----------- | ------------------------- | ---------------- | -------------------- |
| Development | Local/dev testing         | No               | Isolated / ephemeral |
| Staging     | Pre-production validation | No (internal)    | Staging-only         |
| Production  | Live player environment   | Yes              | Public leaderboard   |

Additional environments may exist (QA, preview, etc.) but must follow the same segmentation rules.

---

## 3. Config Segmentation by Environment

Each environment has:

* Its own version pointer
* Its own published bundles
* Its own configHash namespace

This means:

* Publishing to staging does not affect production
* Rolling back production does not affect staging
* Dev/test configs never leak into production

### Version Pointer Example

```
space-blaster/dev/current
space-blaster/staging/current
space-blaster/prod/current
```

Each pointer resolves independently.

---

## 4. Leaderboard Segmentation Rules

Leaderboard data must be isolated by:

1. Environment
2. Game ID
3. (Optionally) configHash

### Minimum Required Segmentation

Leaderboard partition key must include:

```
environment + gameId
```

Production and staging must never share score tables.

---

### Optional / Recommended Segmentation by configHash

To protect competitive integrity when balance changes are significant, scores may also be segmented by:

```
environment + gameId + configHash
```

Two models are acceptable:

#### Model A — Soft Segmentation (Default)

* All scores stored in same leaderboard table
* configHash stored with each score
* Comparability analysis performed externally
* Leaderboard reset handled operationally

#### Model B — Hard Segmentation (Strict Competitive Mode)

* Leaderboards are partitioned per configHash
* Publishing high-impact changes automatically creates a new leaderboard partition
* Old scores remain in their historical partition

Model selection is a product decision, but environment segmentation is mandatory.

---

## 5. configHash and Environment Interaction

A score submission payload must include:

* score
* stats
* duration
* level reached
* configHash
* environment (implicitly via endpoint or explicitly in payload)

This allows:

* forensic debugging
* post-balance comparability checks
* potential retroactive segmentation

Example payload:

```json
{
  "gameId": "space-blaster",
  "environment": "prod",
  "score": 18750,
  "configHash": "sha256-abc123...",
  "stats": {
    "shotsFired": 320,
    "shotsHit": 210,
    "wavesCleared": 6
  }
}
```

---

## 6. Production Deployment Rules

Before publishing to Production:

* Config must pass all schema + structural validators
* Cross-reference validation must succeed
* Preload asset keys must resolve
* Balance change impact should be reviewed (if high-impact)

Optional but recommended:

* Staging publish required before production publish
* Smoke-test run performed under staging configHash

---

## 7. Rollback Rules Per Environment

Rollback affects only the targeted environment.

Example:

* Production rolled back to configHash X
* Staging remains on configHash Y

Rollback does not:

* Delete historical scores
* Alter staging pointer
* Affect active runs

---

## 8. Migration & Promotion Flow

Recommended promotion flow:

```
Dev → Staging → Production
```

Promotion may either:

1. Re-publish artifacts independently per environment
   OR
2. Promote the same bundleId from staging to production (preferred for parity)

If using bundle promotion:

* configHash must remain identical between staging and production

---

## 9. Competitive Integrity Guarantees

Environment segmentation ensures:

* Dev testing never contaminates production leaderboard
* Staging balance experiments do not impact live players
* Rollbacks are safe and isolated
* Leaderboards are explainable and reproducible

---

## 10. Operational Guidelines

### High-Impact Changes (Production)

If a publish modifies:

* Score multipliers
* Combo tiers
* Player speed or lives
* Enemy HP or dive/fire rates

Then one of the following must occur:

* Leaderboard reset
* Leaderboard segmentation
* Explicit public notice (if soft segmentation model is used)

---

## 11. Acceptance Checklist (Issue #57)

* [x] Environment separation rules defined
* [x] Leaderboard isolation rules documented
* [x] configHash interaction with environments defined
* [x] Rollback scoped per environment
* [x] Promotion flow documented

---
