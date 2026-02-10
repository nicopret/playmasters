# Space Blaster Configuration Resolution & Override Precedence

## 1. Purpose

This document defines:

* The authoritative **resolution order** across config domains
* How overrides are applied
* How merge behavior works (replace vs merge)
* What the runtime ultimately receives in the `ResolvedGameConfig` bundle

The goal is to ensure that:

* Resolution is deterministic
* No ambiguity exists when multiple domains define the same field
* Designers can reason about overrides safely
* Runtime receives a self-contained, fully resolved config bundle

This document builds directly on `config-domains.md`.

---

# 2. Resolution Overview

Space Blaster configuration is resolved in **four layers**, applied in strict order:

```
1. Catalog Defaults
2. GameConfig Defaults / Overrides
3. LevelConfig Overrides
4. Difficulty Scaling Modifiers (if enabled)
```

Each successive layer may override values defined earlier.

Resolution occurs **at publish-time or bundle-build time**, not mid-run.

---

# 3. Resolution Precedence (Authoritative Order)

## Layer 1 — Catalog Defaults (Base Layer)

Catalogs define the canonical base configuration for units and assets.

Examples:

* EnemyCatalog.baseHp
* HeroCatalog.moveSpeed
* AmmoCatalog.cooldown
* EnemyCatalog.canDive

Catalog values represent the baseline and must be complete.

No partial definitions are allowed at the catalog level.

---

## Layer 2 — GameConfig Defaults & Overrides

GameConfig may:

* Override catalog defaults globally
* Provide default values for levels that don’t specify overrides
* Define global multipliers or clamps

Examples:

* Default player lives
* Global difficulty multiplier
* Default combo window duration

GameConfig overrides apply to all levels unless explicitly overridden by LevelConfig.

---

## Layer 3 — LevelConfig Overrides

LevelConfig may override:

* Enemy stats (hp overrides per level)
* Formation behavior (speed ramp, descend step)
* Fire/dive caps
* Level multiplier rules
* Wave-specific parameters

LevelConfig overrides take precedence over both Catalog and GameConfig values.

LevelConfig overrides apply only to that specific level.

---

## Layer 4 — Difficulty Scaling Modifiers (Optional)

If a difficulty scaling layer exists (e.g. endless scaling or adaptive difficulty), it is applied last.

Difficulty modifiers may adjust:

* Enemy HP multiplier
* Dive probability multiplier
* Fire rate multiplier
* Score multiplier caps (if allowed)

These modifiers are applied after all static overrides are resolved.

They must:

* Be deterministic
* Be included in the final ResolvedGameConfig
* Be frozen per run

---

# 4. Merge Rules (Replace vs Merge)

Resolution must follow deterministic merge semantics.

## 4.1 Scalar Values (Replace)

Scalar values (numbers, booleans, strings) use **replace semantics**.

Example:

```
Catalog: enemy.hp = 3
GameConfig: no override
LevelConfig: enemy.hp = 5
Final: 5
```

If a later layer defines a scalar field, it fully replaces the earlier value.

---

## 4.2 Object Fields (Shallow Merge)

Objects are merged shallowly unless explicitly defined otherwise.

Example:

Catalog:

```
enemy = {
  hp: 3,
  canDive: true,
  canShoot: false
}
```

LevelConfig override:

```
enemy = {
  hp: 5
}
```

Final:

```
{
  hp: 5,
  canDive: true,
  canShoot: false
}
```

Rules:

* Only provided keys override
* Missing keys retain previous layer value
* No deep recursive merge unless explicitly defined

---

## 4.3 Arrays (Replace, Not Merge)

Arrays are replaced entirely.

Example:

Catalog:

```
comboTiers = [ ... ]
```

GameConfig:

```
comboTiers = [ ...new set... ]
```

Final:

```
comboTiers = new set
```

Partial array merging is not allowed.

This avoids ambiguous ordering and index mutation bugs.

---

## 4.4 Maps / Lookup Tables

Maps keyed by ID (e.g., baseScoreByEnemyId) use:

* Replace if defined at a later layer
* If partial override is needed, it must provide full map replacement

No partial key-level merging unless explicitly documented.

---

# 5. Partial Override Behavior

A partial override:

* May override only specific scalar fields
* Must not introduce new unknown fields
* Must not violate schema constraints

If a partial override results in:

* Missing required fields
* Invalid references
* Invalid ranges

→ Publish must fail during validation.

---

# 6. Conflict Resolution Rules

Conflicts are resolved strictly by precedence.

If two layers define the same field:

```
Catalog < GameConfig < LevelConfig < DifficultyModifier
```

There is no ambiguity and no runtime branching.

---

# 7. Example End-to-End Resolution

Catalog:

```
enemy.hp = 3
enemy.baseScore = 100
```

GameConfig:

```
enemy.hp = 4
levelMultiplierBase = 1.1
```

LevelConfig:

```
enemy.hp = 6
```

DifficultyModifier:

```
enemy.hpMultiplier = 1.5
```

Resolution:

1. Base = 3
2. Game override → 4
3. Level override → 6
4. Difficulty modifier → 6 × 1.5 = 9

Final resolved value: `enemy.hp = 9`

---

# 8. Runtime Contract — What the Game Receives

The runtime receives a fully resolved bundle:

```ts
ResolvedGameConfig = {
  gameConfig,
  levelConfigs,
  heroCatalog,
  enemyCatalog,
  ammoCatalog,
  formationLayouts,
  scoreConfig,
  configHash
}
```

Important properties:

* All overrides already applied
* No domain precedence logic exists in runtime
* No runtime lookups against other config sources
* Immutable during run
* configHash included for submission integrity

---

# 9. Validation Requirements

At publish time:

* All references must resolve
* Overrides must not introduce unknown keys
* Required fields must remain satisfied after merge
* Final resolved shape must conform to runtime TypeScript contract

---

# 10. Operational Guarantees

* Resolution is deterministic
* No runtime ambiguity
* No mid-run override application
* All publishes produce a new version hash
* Rollback restores previous fully resolved state

---

# 11. Acceptance Criteria (Issue #52)

* [ ] Precedence order explicitly defined
* [ ] Merge semantics (replace vs merge) documented
* [ ] Conflict resolution deterministic
* [ ] Example resolution included
* [ ] ResolvedGameConfig contract explicitly defined
