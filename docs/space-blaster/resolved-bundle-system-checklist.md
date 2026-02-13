# Space Blaster Resolved Bundle System Checklist (Issue #141)

This checklist verifies that each gameplay system can run from a single `ResolvedGameConfigV1` bundle without external lookups.

References used for verification:

- Types: `packages/types/src/space-blaster/runtime/resolved-v1.ts`
- Runtime validator: `packages/types/src/space-blaster/runtime/validate-resolved-v1.ts`
- Example fixture: `packages/types/src/space-blaster/runtime/fixtures/resolved-config.example.ts`
- System mapping: `docs/games/space-blaster/systems-to-config-mapping.md`
- Runtime mount context: `packages/games/space-blaster/src/runtime/run-context.ts`

## Resolution/ownership baseline

- Default/override precedence is documented in `docs/games/space-blaster/config-resolution-precedence.md`.
- Runtime receives the final resolved bundle and does not fetch domain fragments mid-run.

## Player system

| Check | Required field path                     | Source domain | Type                                 | Fixture | Mapping |
| ----- | --------------------------------------- | ------------- | ------------------------------------ | ------- | ------- |
| [x]   | `gameConfig.defaultLives`               | GameConfig    | `GameConfigV1.defaultLives`          | present | present |
| [x]   | `gameConfig.timing.comboWindowMs`       | GameConfig    | `GameConfigV1.timing.comboWindowMs`  | present | present |
| [x]   | `heroCatalog.entries[].defaultAmmoId`   | HeroCatalog   | `HeroCatalogEntryV1.defaultAmmoId`   | present | present |
| [x]   | `heroCatalog.entries[].moveSpeed`       | HeroCatalog   | `HeroCatalogEntryV1.moveSpeed`       | present | present |
| [x]   | `heroCatalog.entries[].hitbox`          | HeroCatalog   | `HeroCatalogEntryV1.hitbox`          | present | present |
| [x]   | `ammoCatalog.entries[].projectileSpeed` | AmmoCatalog   | `AmmoCatalogEntryV1.projectileSpeed` | present | present |
| [x]   | `ammoCatalog.entries[].fireCooldownMs`  | AmmoCatalog   | `AmmoCatalogEntryV1.fireCooldownMs`  | present | present |

## Enemy system

| Check | Required field path               | Source domain | Type                               | Fixture | Mapping |
| ----- | --------------------------------- | ------------- | ---------------------------------- | ------- | ------- |
| [x]   | `enemyCatalog.entries[].enemyId`  | EnemyCatalog  | `EnemyCatalogEntryV1.enemyId`      | present | present |
| [x]   | `enemyCatalog.entries[].hp`       | EnemyCatalog  | `EnemyCatalogEntryV1.hp`           | present | present |
| [x]   | `enemyCatalog.entries[].canDive`  | EnemyCatalog  | `EnemyCatalogEntryV1.canDive`      | present | present |
| [x]   | `enemyCatalog.entries[].canShoot` | EnemyCatalog  | `EnemyCatalogEntryV1.canShoot`     | present | present |
| [x]   | `enemyCatalog.entries[].speed`    | EnemyCatalog  | `EnemyCatalogEntryV1.speed`        | present | present |
| [x]   | `levelConfigs[].enemyTypes[]`     | LevelConfig   | `ResolvedLevelConfigV1.enemyTypes` | present | present |
| [x]   | `levelConfigs[].waves[].enemyId`  | LevelConfig   | `LevelWaveV1.enemyId`              | present | present |

## Formation system

| Check | Required field path                   | Source domain    | Type                              | Fixture | Mapping |
| ----- | ------------------------------------- | ---------------- | --------------------------------- | ------- | ------- |
| [x]   | `levelConfigs[].layoutId`             | LevelConfig      | `ResolvedLevelConfigV1.layoutId`  | present | present |
| [x]   | `formationLayouts.entries[].layoutId` | FormationLayouts | `FormationLayoutEntryV1.layoutId` | present | present |
| [x]   | `formationLayouts.entries[].rows`     | FormationLayouts | `FormationLayoutEntryV1.rows`     | present | present |
| [x]   | `formationLayouts.entries[].columns`  | FormationLayouts | `FormationLayoutEntryV1.columns`  | present | present |
| [x]   | `formationLayouts.entries[].spacing`  | FormationLayouts | `FormationLayoutEntryV1.spacing`  | present | present |

## Level/Wave system

| Check | Required field path                   | Source domain | Type                                    | Fixture | Mapping |
| ----- | ------------------------------------- | ------------- | --------------------------------------- | ------- | ------- |
| [x]   | `levelConfigs[]`                      | LevelConfig   | `ResolvedLevelConfigV1[]`               | present | present |
| [x]   | `levelConfigs[].waves[]`              | LevelConfig   | `ResolvedLevelConfigV1.waves`           | present | present |
| [x]   | `levelConfigs[].waves[].count`        | LevelConfig   | `LevelWaveV1.count`                     | present | present |
| [x]   | `levelConfigs[].waves[].spawnDelayMs` | LevelConfig   | `LevelWaveV1.spawnDelayMs`              | present | present |
| [x]   | `levelConfigs[].boss`                 | LevelConfig   | `ResolvedLevelConfigV1.boss`            | present | present |
| [x]   | `levelConfigs[].scoreMultiplier`      | LevelConfig   | `ResolvedLevelConfigV1.scoreMultiplier` | present | present |

## Scoring system

| Check | Required field path                      | Source domain | Type                                     | Fixture | Mapping |
| ----- | ---------------------------------------- | ------------- | ---------------------------------------- | ------- | ------- |
| [x]   | `scoreConfig.baseEnemyScores[]`          | ScoreConfig   | `ScoreConfigV1.baseEnemyScores`          | present | present |
| [x]   | `scoreConfig.combo.tiers[]`              | ScoreConfig   | `ScoreConfigV1.combo.tiers`              | present | present |
| [x]   | `scoreConfig.levelScoreMultiplier`       | ScoreConfig   | `ScoreConfigV1.levelScoreMultiplier`     | present | present |
| [x]   | `scoreConfig.waveClearBonus`             | ScoreConfig   | `ScoreConfigV1.waveClearBonus`           | present | present |
| [x]   | `scoreConfig.accuracyBonus.thresholds[]` | ScoreConfig   | `ScoreConfigV1.accuracyBonus.thresholds` | present | present |
| [x]   | `scoreConfig.survivalBonus`              | ScoreConfig   | `ScoreConfigV1.survivalBonus`            | present | present |

## HUD/presentation hooks (config-driven only)

| Check | Required field path                | Source domain            | Type                               | Fixture | Mapping |
| ----- | ---------------------------------- | ------------------------ | ---------------------------------- | ------- | ------- |
| [x]   | `heroCatalog.entries[].spriteKey`  | HeroCatalog              | `HeroCatalogEntryV1.spriteKey`     | present | present |
| [x]   | `enemyCatalog.entries[].spriteKey` | EnemyCatalog             | `EnemyCatalogEntryV1.spriteKey`    | present | present |
| [x]   | `ammoCatalog.entries[].spriteKey`  | AmmoCatalog              | `AmmoCatalogEntryV1.spriteKey`     | present | present |
| [x]   | `configHash`                       | Resolved bundle metadata | `ResolvedGameConfigV1.configHash`  | present | present |
| [x]   | `versionHash`                      | Resolved bundle metadata | `ResolvedGameConfigV1.versionHash` | present | present |

## No-external-lookup verification

- [x] Runtime mount accepts `resolvedConfig` and stores it in `RunContext` (`packages/games/space-blaster/src/runtime/run-context.ts`).
- [x] Runtime validation checks domain presence + cross references (`layoutId`, `enemyId`, `defaultAmmoId`, score enemy ids).
- [x] Legacy `levels` payloads are normalized into `levelConfigs` in `validateResolvedGameConfigV1`.
- [x] Active runs keep a frozen config reference; updates only stage pending config for next run.

## Drift guard

- [x] Automated check: `packages/games/space-blaster/src/runtime/run-context.spec.ts` validates `resolvedConfigExampleV1` with `validateResolvedGameConfigV1`.
