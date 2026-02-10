# Space Blaster Frozen-Per-Run Guarantees (Competitive Integrity)

## 1) Purpose

Space Blaster is a competitive arcade game with score submission and leaderboards. Because Playmasters supports data-driven tuning via Admin, configuration can change frequently. To protect fairness, comparability, and reproducibility, Space Blaster uses a **Frozen-Per-Run** rule:

> Every run is governed by a single resolved configuration bundle captured at run start. That configuration must remain unchanged until the run ends.

This guarantee prevents mid-run tuning updates from altering difficulty, scoring, or player capabilities while a run is active.

---

## 2) What “Frozen Per Run” Means

When a new run begins, Space Blaster captures:

* A complete `ResolvedGameConfig` bundle (self-contained config for the game)
* A stable `configHash` (or versionHash) identifying that exact bundle

For the rest of the run:

* The game must not replace the bundle
* The game must not mutate the bundle
* Systems must treat config as immutable inputs

When the run ends, the frozen config is released and the next run may resolve the latest published bundle.

---

## 3) When the Config is Captured

Config capture happens at the **start of a run**, not at app launch.

Recommended point in lifecycle:

* On transition to `COUNTDOWN` or `PLAYING` (i.e., “run start”)
* The captured `configHash` is stored in `RunContext`

If a user sits on menus and a new config is published, they will receive the new config only when the next run begins (after restart).

---

## 4) Runtime Behavior When Config Updates Are Published

If Admin publishes a new version while the game is open:

* **Active run:** continues unchanged under the old configHash
* **Paused run:** continues unchanged
* **Results screen:** shows the old configHash
* **Next run:** resolves and uses the latest published bundle

Optional UX behavior (recommended):

* Show a small non-intrusive message: “Update will apply next run.”

---

## 5) Frozen Inputs (What Must Be Frozen for Fairness)

The following inputs materially affect difficulty, survivability, and scoring. These must be frozen per run.

### 5.1 Scoring Inputs (Critical)

* Base scores per enemyId
* Combo tier thresholds
* Combo multipliers
* Tier bonus amounts
* Combo window duration (if configurable)
* Wave clear bonus rules
* Accuracy bonus thresholds and values
* Level multiplier base/per-level/max rules

**Reason:** any mid-run change can inflate or deflate score.

---

### 5.2 Player Capability Inputs (High Impact)

* Move speed
* Lives
* Fire cooldown
* Projectile speed
* Damage (if used)
* Hitbox size / collision tuning (if configurable)

**Reason:** changes affect survivability and scoring potential.

---

### 5.3 Enemy Capability Inputs (High Impact)

* HP values
* Fire tick rate and probability
* Dive tick rate and probability
* Caps:

  * max concurrent divers
  * max concurrent enemy shots
* Pattern rules:

  * tracking turn rate caps
  * dive duration limits
* “Last enemies enrage” threshold and multipliers

**Reason:** changes affect both survival and time-to-score.

---

### 5.4 Formation & Movement Inputs (Medium–High Impact)

* Formation speed and acceleration/ramp rules
* Bounds/reversal behavior
* Descend step distance
* Formation spacing (if it changes bullet density and hit difficulty)

**Reason:** changes affect pacing and risk.

---

### 5.5 Level/Wave Structure Inputs (High Impact)

* Wave composition and enemy mix
* Level progression order
* Any per-level overrides affecting enemy/player parameters

**Reason:** changes affect what the player faces and how scoring is earned.

---

## 6) What Does NOT Need to Be Frozen (Typically)

The following do not affect competitive integrity (or do so minimally) and can be excluded from “frozen” requirements, depending on platform constraints:

* Cosmetic-only assets (backgrounds, UI skins), as long as collision/hitboxes aren’t affected
* Audio tuning and mixing values
* Non-gameplay UI layout shifts

However, to keep the runtime simple and deterministic, it is still recommended to treat the entire resolved bundle as frozen, even if some values are cosmetic.

---

## 7) Implementation Guarantees (Runtime Rules)

### 7.1 Immutable Data Handling

* Store the resolved config in `RunContext` at run start
* Treat it as immutable: no writes, no object mutation
* Pass references into systems via dependency injection rather than global mutable state

### 7.2 configHash Storage

* `RunContext.configHash` must be set at run start
* configHash must be included in score submission payload

### 7.3 No Mid-Run Re-Resolution

* Runtime must not re-fetch or re-resolve config during an active run
* Any “refresh config” feature must only apply when no run is active (or only on next run)

---
