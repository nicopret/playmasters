# Space Blaster Systems -> Config Fields (First Pass)

## Scope

This is the first-pass mapping from runtime systems to canonical config fields.

- Canonical domains: `GameConfig`, `LevelConfig`, `HeroCatalog`, `EnemyCatalog`, `AmmoCatalog`, `FormationLayouts`, `ScoreConfig`
- Field paths are based on the current schemas and resolved bundle structure (`ResolvedGameConfigV1` style: `gameConfig`, `levelConfigs[]`, catalogs, layouts, `scoreConfig`)
- Canonical TS contract source: `packages/types/src/space-blaster/runtime/resolved-v1.ts`
- Status notes:
  - **implemented** = consumed or validated by current runtime/bootstrap
  - **planned** = present in schema/types and intended for gameplay wiring, but not yet fully consumed by current scene logic

## Resolution precedence (first pass)

1. Catalog entry defaults (`heroCatalog` / `enemyCatalog` / `ammoCatalog` / `formationLayouts`)
2. Global defaults in `gameConfig` / `scoreConfig`
3. Per-level overrides in `levelConfigs[]` (when a corresponding field exists)

If no override field exists in schema/types, override location is `none`.

---

## 1) Player System

| System | Config field            | Field path                                                                  | Source domain | Default location                  | Override location                                        | Notes                                                                      |
| ------ | ----------------------- | --------------------------------------------------------------------------- | ------------- | --------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| Player | Default lives           | `gameConfig.defaultLives`                                                   | GameConfig    | `gameConfig.defaultLives`         | `heroCatalog.entries[].maxLives` (hero selection driven) | planned                                                                    |
| Player | Combo timing dependency | `gameConfig.timing.comboWindowMs`                                           | GameConfig    | `gameConfig.timing.comboWindowMs` | `scoreConfig.combo.windowMs`                             | planned (used by scoring cadence)                                          |
| Player | Hero move speed         | `heroCatalog.entries[].moveSpeed`                                           | HeroCatalog   | `heroCatalog.entries[].moveSpeed` | none                                                     | planned                                                                    |
| Player | Hero hitbox             | `heroCatalog.entries[].hitbox.width`, `heroCatalog.entries[].hitbox.height` | HeroCatalog   | `heroCatalog.entries[]`           | none                                                     | planned                                                                    |
| Player | Default ammo selection  | `heroCatalog.entries[].defaultAmmoId`                                       | HeroCatalog   | `heroCatalog.entries[]`           | none                                                     | implemented in run-context validation (ammo linkage), gameplay use planned |
| Player | Projectile speed        | `ammoCatalog.entries[].projectileSpeed`                                     | AmmoCatalog   | `ammoCatalog.entries[]`           | none                                                     | planned                                                                    |
| Player | Fire cooldown           | `ammoCatalog.entries[].fireCooldownMs`                                      | AmmoCatalog   | `ammoCatalog.entries[]`           | none                                                     | planned                                                                    |
| Player | Projectile damage       | `ammoCatalog.entries[].damage`                                              | AmmoCatalog   | `ammoCatalog.entries[]`           | none                                                     | planned                                                                    |

---

## 2) Enemy System

| System | Config field        | Field path                                    | Source domain | Default location         | Override location                                | Notes                                                       |
| ------ | ------------------- | --------------------------------------------- | ------------- | ------------------------ | ------------------------------------------------ | ----------------------------------------------------------- |
| Enemy  | Enemy identity      | `enemyCatalog.entries[].enemyId`              | EnemyCatalog  | `enemyCatalog.entries[]` | `levelConfigs[].waves[].enemyId` (selection)     | implemented (cross-check in run-context)                    |
| Enemy  | Hit points          | `enemyCatalog.entries[].hp`                   | EnemyCatalog  | `enemyCatalog.entries[]` | none                                             | planned                                                     |
| Enemy  | Can dive            | `enemyCatalog.entries[].canDive`              | EnemyCatalog  | `enemyCatalog.entries[]` | `levelConfigs[].dive` (spawn/behavior intensity) | planned                                                     |
| Enemy  | Can shoot           | `enemyCatalog.entries[].canShoot`             | EnemyCatalog  | `enemyCatalog.entries[]` | `levelConfigs[].shooting`                        | planned                                                     |
| Enemy  | Base movement speed | `enemyCatalog.entries[].speed`                | EnemyCatalog  | `enemyCatalog.entries[]` | `levelConfigs[].speed`                           | planned                                                     |
| Enemy  | Projectile cooldown | `enemyCatalog.entries[].projectileCooldownMs` | EnemyCatalog  | `enemyCatalog.entries[]` | `levelConfigs[].shooting`                        | planned                                                     |
| Enemy  | Dive cooldown       | `enemyCatalog.entries[].diveCooldownMs`       | EnemyCatalog  | `enemyCatalog.entries[]` | `levelConfigs[].dive`                            | planned                                                     |
| Enemy  | Allowed enemy list  | `levelConfigs[].enemyTypes[]`                 | LevelConfig   | `levelConfigs[]`         | none                                             | implemented in validation (must resolve into enemy catalog) |

---

## 3) Formation System

| System    | Config field          | Field path                                                                     | Source domain    | Default location             | Override location | Notes                                 |
| --------- | --------------------- | ------------------------------------------------------------------------------ | ---------------- | ---------------------------- | ----------------- | ------------------------------------- |
| Formation | Layout reference      | `levelConfigs[].layoutId`                                                      | LevelConfig      | `levelConfigs[]`             | none              | implemented in run-context validation |
| Formation | Layout rows           | `formationLayouts.entries[].rows`                                              | FormationLayouts | `formationLayouts.entries[]` | none              | planned                               |
| Formation | Layout columns        | `formationLayouts.entries[].columns`                                           | FormationLayouts | `formationLayouts.entries[]` | none              | planned                               |
| Formation | Layout spacing X/Y    | `formationLayouts.entries[].spacing.x`, `formationLayouts.entries[].spacing.y` | FormationLayouts | `formationLayouts.entries[]` | none              | planned                               |
| Formation | Layout offset         | `formationLayouts.entries[].offset.x`, `formationLayouts.entries[].offset.y`   | FormationLayouts | `formationLayouts.entries[]` | none              | planned                               |
| Formation | Compact mode          | `formationLayouts.entries[].compact`                                           | FormationLayouts | `formationLayouts.entries[]` | none              | planned                               |
| Formation | Level movement scalar | `levelConfigs[].speed`                                                         | LevelConfig      | `levelConfigs[]`             | none              | planned                               |

---

## 4) Level / Wave System

| System     | Config field              | Field path                            | Source domain | Default location | Override location                             | Notes                                         |
| ---------- | ------------------------- | ------------------------------------- | ------------- | ---------------- | --------------------------------------------- | --------------------------------------------- |
| Level/Wave | Level list                | `levelConfigs[]`                      | LevelConfig   | `levelConfigs[]` | none                                          | implemented at run-context contract level     |
| Level/Wave | Boss flag                 | `levelConfigs[].boss`                 | LevelConfig   | `levelConfigs[]` | none                                          | planned                                       |
| Level/Wave | Dive intensity            | `levelConfigs[].dive`                 | LevelConfig   | `levelConfigs[]` | none                                          | planned                                       |
| Level/Wave | Shooting intensity        | `levelConfigs[].shooting`             | LevelConfig   | `levelConfigs[]` | none                                          | planned                                       |
| Level/Wave | Score multiplier override | `levelConfigs[].scoreMultiplier`      | LevelConfig   | `levelConfigs[]` | `scoreConfig.levelScoreMultiplier.*` (global) | planned                                       |
| Level/Wave | Wave enemy id             | `levelConfigs[].waves[].enemyId`      | LevelConfig   | `levelConfigs[]` | `enemyCatalog.entries[]` (validation source)  | implemented validation + planned gameplay use |
| Level/Wave | Wave enemy count          | `levelConfigs[].waves[].count`        | LevelConfig   | `levelConfigs[]` | none                                          | planned                                       |
| Level/Wave | Wave spawn delay          | `levelConfigs[].waves[].spawnDelayMs` | LevelConfig   | `levelConfigs[]` | none                                          | planned                                       |

---

## 5) Scoring System

| System  | Config field        | Field path                                                                                                                   | Source domain | Default location                   | Override location                | Notes                                                            |
| ------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------- | -------------------------------- | ---------------------------------------------------------------- |
| Scoring | Enemy base scores   | `scoreConfig.baseEnemyScores[].enemyId`, `scoreConfig.baseEnemyScores[].score`                                               | ScoreConfig   | `scoreConfig.baseEnemyScores[]`    | none                             | implemented validation for enemyId linkage; gameplay use planned |
| Scoring | Combo enabled       | `scoreConfig.combo.enabled`                                                                                                  | ScoreConfig   | `scoreConfig.combo`                | none                             | planned                                                          |
| Scoring | Combo tiers         | `scoreConfig.combo.tiers[].minCount`, `scoreConfig.combo.tiers[].multiplier`, `scoreConfig.combo.tiers[].tierBonus`          | ScoreConfig   | `scoreConfig.combo.tiers[]`        | none                             | planned                                                          |
| Scoring | Combo windows       | `scoreConfig.combo.minWindowMs`, `scoreConfig.combo.windowMs`, `scoreConfig.combo.windowDecayPerLevelMs`                     | ScoreConfig   | `scoreConfig.combo`                | none                             | planned                                                          |
| Scoring | Level multiplier    | `scoreConfig.levelScoreMultiplier.base`, `scoreConfig.levelScoreMultiplier.perLevel`, `scoreConfig.levelScoreMultiplier.max` | ScoreConfig   | `scoreConfig.levelScoreMultiplier` | `levelConfigs[].scoreMultiplier` | planned                                                          |
| Scoring | Wave clear bonus    | `scoreConfig.waveClearBonus.base`, `scoreConfig.waveClearBonus.perLifeBonus`                                                 | ScoreConfig   | `scoreConfig.waveClearBonus`       | none                             | planned                                                          |
| Scoring | Accuracy thresholds | `scoreConfig.accuracyBonus.thresholds[].minAccuracy`, `scoreConfig.accuracyBonus.thresholds[].bonus`                         | ScoreConfig   | `scoreConfig.accuracyBonus`        | none                             | planned                                                          |
| Scoring | Survival bonus      | `scoreConfig.survivalBonus.bonus`, `scoreConfig.survivalBonus.perSeconds`                                                    | ScoreConfig   | `scoreConfig.survivalBonus`        | none                             | planned                                                          |

---

## 6) HUD / Presentation Hooks (config-driven only)

| System           | Config field                  | Field path                                                                                                                                                                                         | Source domain                     | Default location                     | Override location      | Notes                      |
| ---------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------ | ---------------------- | -------------------------- |
| HUD/Presentation | Hero sprite key               | `heroCatalog.entries[].spriteKey`                                                                                                                                                                  | HeroCatalog                       | `heroCatalog.entries[]`              | none                   | planned                    |
| HUD/Presentation | Hero VFX/SFX keys             | `heroCatalog.entries[].hurtFlashSpriteKey`, `heroCatalog.entries[].engineTrailFxKey`, `heroCatalog.entries[].fireSfxKey`, `heroCatalog.entries[].hitSfxKey`                                        | HeroCatalog                       | `heroCatalog.entries[]`              | none                   | planned                    |
| HUD/Presentation | Enemy sprite/VFX/SFX keys     | `enemyCatalog.entries[].spriteKey`, `enemyCatalog.entries[].fireSfxKey`, `enemyCatalog.entries[].deathSfxKey`, `enemyCatalog.entries[].diveTelegraphSfxKey`, `enemyCatalog.entries[].explodeFxKey` | EnemyCatalog                      | `enemyCatalog.entries[]`             | none                   | planned                    |
| HUD/Presentation | Ammo sprite/VFX/SFX keys      | `ammoCatalog.entries[].spriteKey`, `ammoCatalog.entries[].fireSfxKey`, `ammoCatalog.entries[].impactFxKey`                                                                                         | AmmoCatalog                       | `ammoCatalog.entries[]`              | none                   | planned                    |
| HUD/Presentation | Active run hash display/debug | `RunContext.configHash` (captured from `resolvedConfig.configHash`)                                                                                                                                | Resolved bundle / runtime context | `resolvedConfig.configHash` at mount | none during active run | implemented freeze-per-run |

---

## Traceability notes

- Runtime freeze context implementation:
  - `packages/games/space-blaster/src/runtime/run-context.ts`
- Runtime freeze tests:
  - `packages/games/space-blaster/src/runtime/run-context.spec.ts`
- Resolved config validator + fixture:
  - `packages/types/src/space-blaster/runtime/guards/validate-resolved-v1.ts`
  - `packages/types/src/space-blaster/runtime/fixtures/resolved-config.example.ts`
  - runtime mount validation path: `packages/games/space-blaster/src/runtime/run-context.ts`
- Canonical schemas:
  - `packages/types/src/space-blaster/schemas/*.schema.json`

## Coverage checklist (#96)

- [x] Player mapped
- [x] Enemy mapped
- [x] Formation mapped
- [x] Levels/Waves mapped
- [x] Scoring mapped
