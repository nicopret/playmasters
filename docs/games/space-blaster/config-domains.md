## Space Blaster Config Domains & Ownership (Authoritative)

Space Blaster is designed to be **fully data-driven** on Playmasters: balancing, progression, and most tuning should be adjustable through the Admin client and published without rebuilding the game. To make that safe (and leaderboard-fair), the runtime consumes a single **ResolvedGameConfig** bundle at the start of a run, and that bundle is **frozen for the entire run**. ([GitHub][1])

### Key rule

**Published config affects only new sessions**. Active runs continue using the config bundle they started with.

---

### Domain Summary Table

| Domain                        | Purpose                                                                                                                                | Owned By                                | Publish Lifecycle          | Versioning Rules                                                                       | Runtime Consumption                                     | Stability Guarantee |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------- |
| **GameConfig**                | Global defaults for Space Blaster: baseline lives, global timing defaults, default difficulty/scoring references, mode flags.          | Admin (authoring) / Runtime (read-only) | Draft → Staged → Published | Immutable once published; changes require new published version                        | Included in resolved bundle (embedded)                  | Frozen per run      |
| **LevelConfig[]**             | Defines level progression: waves, formation selection, speed/dive/fire parameters, per-level multipliers/overrides.                    | Admin / Runtime (read-only)             | Draft → Staged → Published | Immutable once published; each level config belongs to a published bundle/version      | Included in resolved bundle (embedded list)             | Frozen per run      |
| **HeroCatalog**               | Defines the player unit(s): movement speed, hitbox, lives defaults, default ammo binding, visual/audio keys.                           | Admin / Runtime (read-only)             | Draft → Staged → Published | Immutable once published; referenced by heroId                                         | Included in resolved bundle (embedded catalog)          | Frozen per run      |
| **EnemyCatalog**              | Defines enemy units: hp, score base id, ability flags (shoot/dive), dive behavior params and visual/audio keys.                        | Admin / Runtime (read-only)             | Draft → Staged → Published | Immutable once published; referenced by enemyId                                        | Included in resolved bundle (embedded catalog)          | Frozen per run      |
| **AmmoCatalog**               | Defines projectile params: speed, cooldown, damage (if used), sprite/audio keys.                                                       | Admin / Runtime (read-only)             | Draft → Staged → Published | Immutable once published; referenced by ammoId                                         | Included in resolved bundle (embedded catalog)          | Frozen per run      |
| **FormationLayouts**          | Defines the formation grid layout(s): rows/cols, spacing, offsets, compaction rules.                                                   | Admin / Runtime (read-only)             | Draft → Staged → Published | Immutable once published; referenced by layoutId                                       | Included in resolved bundle (embedded layouts)          | Frozen per run      |
| **ScoreConfig**               | Defines scoring rules: base score mapping, level multiplier rules, combo tiers, tier bonuses, wave clear bonuses, accuracy thresholds. | Admin / Runtime (read-only)             | Draft → Staged → Published | Immutable once published; changes may impact leaderboard comparability                 | Included in resolved bundle (embedded)                  | Frozen per run      |
| **Published Bundle Metadata** | Version pointer + configHash/versionHash, publish timestamp, optional version id. Used for caching + score submission integrity.       | Platform (generated), visible to Admin  | Generated at publish       | Hash changes whenever any included artifact changes; older versions remain addressable | Included in resolved bundle as `configHash/versionHash` | Frozen per run      |

---

### Canonical IDs and Reference Rules

* **LevelConfig** references:

  * `layoutId` → must exist in FormationLayouts
  * `enemyId` values in waves → must exist in EnemyCatalog
* **HeroCatalog** references:

  * `defaultAmmoId` → must exist in AmmoCatalog
* **ScoreConfig** references:

  * enemy score entries keyed by `enemyId` (or equivalent mapping) → must exist in EnemyCatalog

These references must be **validated at publish time** (publish-blocking) so the runtime never receives a bundle with dangling IDs.

---

### Ownership and Mutation Rules

* **Admin Client owns authoring** (Draft/Staged edits).
* **Published artifacts are immutable**.
* **Runtime is a pure consumer**:

  * It reads a resolved config bundle at mount/run start.
  * It must not mutate config objects.
  * It must not fetch additional config mid-run.

If a new version is published while a player is mid-run:

* The active run continues unchanged.
* The next run resolves the latest published bundle.

---

### Runtime Consumption Contract (High Level)

At runtime, Space Blaster should receive:

```ts
ResolvedGameConfig = {
  gameConfig,
  levelConfigs,
  heroCatalog,
  enemyCatalog,
  ammoCatalog,
  formationLayouts,
  scoreConfig,
  configHash, // or versionHash
}
```

This is a **self-contained** bundle so that gameplay systems don’t perform id-based lookups against remote sources, and so replay/submission integrity can be tied to a specific configuration hash.

---

### Notes for Competitive Integrity

Some fields materially affect score comparability across versions (examples: score multipliers, combo tiers, base enemy scores). These don’t need to block publishing, but they should be treated as **high-impact changes** operationally (segmentation/reset policy handled elsewhere).


