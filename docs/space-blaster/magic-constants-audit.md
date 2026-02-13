# Space Blaster Runtime Magic Constants Audit (First Pass)

## Summary

- Runtime files scanned: `packages/games/space-blaster/src/game.ts`, `packages/games/space-blaster/src/runtime/run-context.ts`
- Tuning-relevant constants identified: **18**
- Classified as **must be config-driven**: **11**
- Classified as **should remain constant**: **7**

This audit is based on constants currently hardcoded in runtime gameplay code. It does not rename or break existing schema fields; proposed additions are optional and backward compatible.

## Classification table

| System             | File:line                                               | Constant / context          | Value (units)                                | Classification         | Proposed config domain + field path                                                  | Default when absent        | Notes / justification                                              |
| ------------------ | ------------------------------------------------------- | --------------------------- | -------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------ | -------------------------- | ------------------------------------------------------------------ |
| Player             | `packages/games/space-blaster/src/game.ts:137`          | Horizontal move velocity    | `380` px/s                                   | Must be config-driven  | `heroCatalog.entries[].moveSpeed` (existing)                                         | `380`                      | Runtime should use selected hero move speed.                       |
| Player             | `packages/games/space-blaster/src/game.ts:220`          | Manual fire debounce        | `200` ms                                     | Must be config-driven  | `ammoCatalog.entries[].fireCooldownMs` (existing)                                    | `200`                      | Align manual cadence with ammo catalog.                            |
| Player             | `packages/games/space-blaster/src/game.ts:237`          | Bullet speed                | `560` px/s                                   | Must be config-driven  | `ammoCatalog.entries[].projectileSpeed` (existing)                                   | `560`                      | Gameplay tuning + fairness-sensitive.                              |
| Player             | `packages/games/space-blaster/src/game.ts:230-231`      | Bullet rectangle size       | `6x16` px                                    | Must be config-driven  | `gameConfig.player.projectileSize` (additive, optional)                              | `{ width: 6, height: 16 }` | Affects hit profile and readability.                               |
| Player             | `packages/games/space-blaster/src/game.ts:238`          | Bullet collision radius     | `3` px                                       | Must be config-driven  | `gameConfig.player.projectileHitRadius` (additive, optional)                         | `3`                        | Hit detection tuning.                                              |
| Player             | `packages/games/space-blaster/src/game.ts:72`           | Player drag X               | `650`                                        | Must be config-driven  | `gameConfig.player.dragX` (additive, optional)                                       | `650`                      | Movement feel tuning.                                              |
| Enemy              | `packages/games/space-blaster/src/game.ts:198`          | Spawn interval              | `1000` ms                                    | Must be config-driven  | `levelConfigs[].spawnIntervalMs` (additive, optional)                                | `1000`                     | Core level pacing.                                                 |
| Enemy              | `packages/games/space-blaster/src/game.ts:249`          | Enemy descent speed range   | `90..160` px/s                               | Must be config-driven  | `enemyCatalog.entries[].speed` (existing) + `levelConfigs[].speed` (existing scalar) | `90..160`                  | Difficulty/fairness-sensitive.                                     |
| Enemy              | `packages/games/space-blaster/src/game.ts:244`          | Spawn X padding from bounds | `30` px                                      | Must be config-driven  | `levelConfigs[].spawnMarginX` (additive, optional)                                   | `30`                       | Affects threat density and edge safety.                            |
| Enemy              | `packages/games/space-blaster/src/game.ts:250`          | Enemy collision radius      | `12` px                                      | Must be config-driven  | `enemyCatalog.entries[].hitboxRadius` (additive, optional)                           | `12`                       | Collision fairness tuning.                                         |
| Scoring            | `packages/games/space-blaster/src/game.ts:117`          | Per-kill score delta        | `10` points                                  | Must be config-driven  | `scoreConfig.baseEnemyScores[].score` (existing)                                     | `10`                       | Should come from enemyId score map.                                |
| Formation / Level  | `packages/games/space-blaster/src/game.ts:152`          | Lose threshold from floor   | `WORLD_HEIGHT - 12` px                       | Must be config-driven  | `levelConfigs[].descendLoseOffsetPx` (additive, optional)                            | `12`                       | Defines fail boundary sensitivity.                                 |
| HUD / Presentation | `packages/games/space-blaster/src/game.ts:14-15`        | World size                  | `800x450` px                                 | Should remain constant | none                                                                                 | fixed                      | Rendering baseline and aspect contract for current Phaser scene.   |
| HUD / Presentation | `packages/games/space-blaster/src/game.ts:62-67`        | Player rectangle size/color | `52x26`, `0x3aa9e0`                          | Should remain constant | none                                                                                 | fixed                      | Placeholder visuals for prototype scene; cosmetics only right now. |
| HUD / Presentation | `packages/games/space-blaster/src/game.ts:245`          | Enemy rectangle size/color  | `34x24`, `0xe94b5a`                          | Should remain constant | none                                                                                 | fixed                      | Placeholder visuals until sprite-driven rendering lands.           |
| HUD / Presentation | `packages/games/space-blaster/src/game.ts:50,58,60,320` | Background/stroke colors    | `#0f111a`, `0x101628`, `0x3aa9e0`, `#0b0d13` | Should remain constant | none                                                                                 | fixed                      | Non-gameplay skin constants.                                       |
| Runtime invariant  | `packages/games/space-blaster/src/game.ts:324`          | Arcade debug toggle         | `false`                                      | Should remain constant | none                                                                                 | `false`                    | Technical/performance guard; not gameplay tuning.                  |
| Runtime invariant  | `packages/games/space-blaster/src/game.ts:328-329`      | Scale mode / auto-center    | `FIT`, `CENTER_BOTH`                         | Should remain constant | none                                                                                 | fixed                      | Engine/layout behavior, not gameplay tuning.                       |

## Critical tuning coverage check

All critical gameplay tuning categories are documented in this audit:

- Player movement / shooting cadence and projectile behavior
- Enemy spawn and movement pacing
- Formation / level fail boundary behavior
- Scoring per kill
- Collision caps/radii used by gameplay interactions

## Proposed additive schema/config changes (backward compatible)

Use optional fields only; preserve current behavior when absent:

### GameConfig (optional additions)

- `gameConfig.player.dragX?: number` (default `650`)
- `gameConfig.player.projectileSize?: { width: number; height: number }` (default `6x16`)
- `gameConfig.player.projectileHitRadius?: number` (default `3`)

### LevelConfig (optional additions)

- `levelConfigs[].spawnIntervalMs?: number` (default `1000`)
- `levelConfigs[].spawnMarginX?: number` (default `30`)
- `levelConfigs[].descendLoseOffsetPx?: number` (default `12`)

### EnemyCatalog (optional additions)

- `enemyCatalog.entries[].hitboxRadius?: number` (default `12`)

## Existing fields that should be wired before adding new ones

Prefer wiring runtime to existing schema fields first:

- `heroCatalog.entries[].moveSpeed` (player movement)
- `ammoCatalog.entries[].fireCooldownMs` and `ammoCatalog.entries[].projectileSpeed` (shooting cadence and bullet speed)
- `enemyCatalog.entries[].speed` + `levelConfigs[].speed` (enemy movement)
- `scoreConfig.baseEnemyScores[].score` (per-enemy points)

## Backward compatibility statement

All proposed additions are optional and additive. If missing, runtime falls back to current hardcoded values listed above, preserving existing behavior and schema compatibility.
