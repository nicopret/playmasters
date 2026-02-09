# Space Blaster Publish Validation Pipeline & Error Model

## 1. Purpose

Space Blaster is a data-driven competitive arcade game. Publishing configuration changes must be safe, deterministic, and enforce competitive integrity.

This document defines:

* The full publish validation pipeline
* Validation ordering and gating rules
* Error and warning structure returned to Admin
* When bundle hashing occurs
* What artifacts are created on successful publish

This specification governs all configuration publishes in Dev, Staging, and Production.

---

# 2. Publish Pipeline Overview

Publishing follows a strict multi-stage validation flow:

```
1. Schema Validation
2. Structural Validation
3. Cross-Reference Validation
4. Resolution & Merge Validation
5. Asset Reference Validation
6. Frozen-Per-Run Compliance Check
7. Bundle Assembly & Hashing
8. Pointer Update
```

A publish must not proceed past any stage that returns blocking errors.

---

# 3. Validation Stages (Authoritative Order)

## 3.1 Schema Validation

Ensures each domain artifact conforms to its JSON schema or TypeScript interface.

Examples:

* Required fields exist
* Types match expected types
* No unknown fields (if strict mode enabled)
* Enum values are valid

Failure type: **publish-blocking**

---

## 3.2 Structural Validation

Ensures logical consistency inside each artifact.

Examples:

* Level has ≥ 1 wave
* Wave enemy counts ≥ 0
* Formation capacity not exceeded
* Boss configuration complete if enabled

Failure type: **publish-blocking**

---

## 3.3 Cross-Reference Validation

Ensures all ID references resolve.

Examples:

* LevelConfig.layoutId → FormationLayouts
* Wave enemyId → EnemyCatalog
* Hero.defaultAmmoId → AmmoCatalog
* ScoreConfig.enemyId keys → EnemyCatalog

Failure type: **publish-blocking**

No dangling references allowed in published bundles.

---

## 3.4 Resolution & Merge Validation

Simulate full resolution process:

```
Catalog defaults
→ GameConfig overrides
→ LevelConfig overrides
→ Difficulty modifiers
```

After resolution:

* All required fields must remain present
* No illegal overrides allowed
* Final resolved object must match runtime contract

Failure type: **publish-blocking**

---

## 3.5 Asset Reference Validation

Validate asset keys used by config.

Two levels:

### Strict (recommended for gameplay assets)

Fail publish if:

* Required spriteKey missing
* Required audio key malformed
* Enemy used in a level lacks required spriteKey

### Warning-level (optional)

Warn but do not block if:

* Non-critical music key missing
* Cosmetic UI key missing

---

## 3.6 Frozen-Per-Run Compliance Check

Ensure no config mutation rules are violated:

* No dynamic-only fields required at runtime
* No environment-mixed references
* No runtime-dependent conditional overrides

This stage ensures the bundle is safe to freeze per run.

Failure type: **publish-blocking**

---

## 3.7 Bundle Assembly & Hashing

If all validation passes:

1. Assemble canonical bundle object
2. Canonicalize field order
3. Compute stable hash (e.g., SHA-256)
4. Store:

   * bundleId
   * configHash
   * publishedAt timestamp
   * artifact references

The bundle is immutable once stored.

---

## 3.8 Pointer Update

Final stage:

* Update environment-specific version pointer:

  * `space-blaster/dev/current`
  * `space-blaster/staging/current`
  * `space-blaster/prod/current`

Pointer update must be atomic.

If pointer update fails:

* Publish is considered incomplete
* Pointer remains unchanged

---

# 4. Error Model

All validation stages must return structured error objects.

Each error includes:

```json
{
  "severity": "error" | "warning",
  "domain": "LevelConfig" | "EnemyCatalog" | ...,
  "sourceId": "level_1",
  "path": "waves[2].enemies[0].enemyId",
  "message": "Unknown enemyId 'enemy_striker_02'",
  "stage": "cross-reference"
}
```

## 4.1 Severity Levels

### error

* Publish-blocking
* Must be resolved before proceeding

### warning

* Publish allowed
* Logged and surfaced to Admin
* May require review before production promotion

---

# 5. Admin Client Behavior

When publish fails:

* Display grouped errors by stage
* Highlight blocking errors
* Show JSON path or UI mapping for each issue
* Do not compute or display configHash

When publish succeeds:

* Display:

  * bundleId
  * configHash
  * publish timestamp
  * environment
* Provide rollback option

---

# 6. Logging & Audit Requirements

Each publish attempt must record:

* Environment
* Actor (Admin user id)
* Validation result
* List of blocking errors (if any)
* bundleId + configHash (on success)
* Pointer update result

Rollback events must be logged similarly.

---

# 7. Performance Requirements

Validation must:

* Complete within acceptable Admin response time (<2–3s recommended)
* Avoid network fetches during validation (use in-memory artifacts)
* Be deterministic

Bundle hashing must use canonical representation to avoid hash drift.

---

# 8. Failure Handling Rules

If any publish-blocking validation fails:

* No bundle is created
* No pointer is updated
* No configHash is generated
* No partial artifacts are committed

Publish is atomic: success or no change.

---
