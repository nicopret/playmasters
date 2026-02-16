# ScoreSystem Test Matrix (Ticket #187)

## Scope And Invariants

This matrix covers `packages/games/space-blaster/src/scoring/ScoreSystem.ts` and related scoring helpers.

Core invariants to validate in tests:

- Score is monotonic (never decreases).
- Behavior is deterministic for a given event order and `nowMs`.
- Breakdown accounting is exact:
  - `killPoints + comboExtra + tierBonuses + waveClearBonuses + accuracyBonus === score`
- One-time/idempotent rules:
  - tier entry bonus applies once per tier entry
  - wave clear bonus applies once per `(levelNumber, waveIndex)`
  - `finalizeRun()` applies accuracy bonus once

## Required Config Knobs (Real Field Paths)

From `ScoreConfigV1` (`packages/types/src/space-blaster/runtime/domains-v1.ts`) and schema (`packages/types/src/space-blaster/schemas/score-config.schema.json`):

- `scoreConfig.baseEnemyScores[]`:
  - `enemyId`, `score`
- `scoreConfig.combo.enabled`
- `scoreConfig.combo.windowMs`
- `scoreConfig.combo.minWindowMs` (schema/type field; currently not consumed in `ScoreSystem`)
- `scoreConfig.combo.resetOnPlayerHit`
- `scoreConfig.combo.tiers[]`:
  - `minCount`, `multiplier`, `name`, `tierBonus?`
- `scoreConfig.levelScoreMultiplier`:
  - `base`, `perLevel`, `max`
- `scoreConfig.waveClearBonus`:
  - `base`, `perLifeBonus`
- `scoreConfig.accuracyBonus?.thresholds[]`:
  - `minAccuracy`, `bonus`
- `scoreConfig.accuracyBonus?.scaleByLevelMultiplier`
- `scoreConfig.eventLogSize?` (default used in `ScoreSystem`: `50`)

## Rounding And Ordering Rules

- Level multiplier:
  - `raw = base + perLevel * (levelNumber - 1)`
  - clamped to `[0, max]`
- Kill scoring:
  - `killPointsBase = round(baseEnemyScore * levelMultiplier)`
  - tier selected as highest `minCount <= comboCount`
  - `killPointsFromMultiplier = round(killPointsBase * tier.multiplier)`
  - `comboExtra = killPointsFromMultiplier - killPointsBase`
  - `tierBonus` added only on tier entry
- Combo:
  - qualifying kill within window increments combo
  - window refreshes to `nowMs + combo.windowMs`
  - if expired (`nowMs > comboExpiresAtMs`) chain resets before kill
- Accuracy:
  - `accuracy = shotsHit / max(1, shotsFired)`
  - clamped `[0..1]`
  - highest threshold met is selected
- Wave clear:
  - wave key: `${levelNumber}:${waveIndex}`
  - total = `round(base * levelMultiplier) + round(perLifeBonus * livesRemaining * levelMultiplier)`
  - key de-duplicates repeated events

## Test Matrix

| Area                | Scenario                          | Inputs (Config + Events + Time)                            | Expected Outputs                               | Notes                                          |
| ------------------- | --------------------------------- | ---------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------- |
| Combo progression   | First kill starts chain           | `combo.enabled=true`, `windowMs>0`; `onEnemyKilled(e1,t0)` | `comboCount=1`, `comboExpiresAtMs=t0+windowMs` | `onEnemyKilled`                                |
| Combo progression   | Qualifying kill increments chain  | Kills at `t0`, `t0+windowMs-1`                             | `comboCount=2`, expiry refreshed               | refresh semantics                              |
| Combo progression   | Kill after expiry resets to 1     | Kills at `t0`, `t0+windowMs+1`                             | chain reset then `comboCount=1`                | `resetComboIfExpired`                          |
| Combo progression   | `maxComboCount` tracks peak       | increasing combo then reset                                | `maxComboCount` unchanged by reset             | state regression guard                         |
| Tier one-time bonus | Enter tier grants bonus once      | tier at `minCount=2`; kills reach 2                        | `tierBonuses += tierBonus` once                | `computeTierEntryBonus`                        |
| Tier one-time bonus | Stay in tier does not re-award    | kills continue in same tier                                | `tierBonuses` unchanged                        | idempotent within tier                         |
| Tier one-time bonus | Reset then re-enter awards again  | force reset then reach same tier                           | bonus awarded again                            | new chain entry                                |
| Combo reset         | Reset on expiry emits reset event | expiry path                                                | `lastResetReason='EXPIRED'` and combo reset    | `resetComboState`                              |
| Combo reset         | Reset on player hit enabled       | `resetOnPlayerHit=true`; `onPlayerHit(t)`                  | combo/tier state cleared                       | no score decrease                              |
| Combo reset         | Reset on player hit disabled      | `resetOnPlayerHit=false`; `onPlayerHit(t)`                 | combo unchanged                                | config-gated                                   |
| Multiplier clamp    | Level 1 baseline                  | `levelNumber=1`                                            | multiplier = `base`                            | `computeLevelMultiplier`                       |
| Multiplier clamp    | High level clamps to max          | large `levelNumber`                                        | multiplier <= `max`                            | clamp contract                                 |
| Kill points         | Rounded base points               | `baseEnemyScore=100`, multiplier `1.25`                    | `killPointsBase=125`                           | round before tier multiplier                   |
| Accuracy thresholds | Zero shots edge case              | `shotsFired=0`, `shotsHit=0`                               | `accuracy=0`                                   | `computeAccuracy`                              |
| Accuracy thresholds | Defensive clamp                   | impossible `shotsHit>shotsFired`                           | accuracy clamped <= 1                          | safety                                         |
| Accuracy thresholds | Highest threshold chosen          | thresholds `[0.5,0.8]`, accuracy `0.85`                    | selects `0.8` threshold                        | highest met                                    |
| Accuracy finalize   | Finalize idempotency              | call `finalizeRun(t1)`, again `finalizeRun(t2)`            | bonus added once; `finalized=true`             | no double-award                                |
| Accuracy finalize   | Optional level scaling            | `scaleByLevelMultiplier=true`                              | bonus scaled and rounded                       | config path                                    |
| Wave bonus          | Base + per-life formula           | call `onWaveCleared({level,wave,lives,nowMs})`             | `waveClearBonuses` increments by formula       | level-multiplied in current impl               |
| Wave bonus          | Wave clear idempotency key        | same `level:wave` twice                                    | second call no-op                              | `appliedWaveBonusKeys`                         |
| Breakdown invariant | Sum equals score                  | sequence with kill/combo/tier/wave/accuracy                | invariant always holds                         | `assertBreakdownInvariant` throws on violation |
| Event log           | Bounded last-N events             | many score events, `eventLogSize=3`                        | log length never > 3, oldest dropped           | ring-like truncation                           |

## Acceptance Coverage Sections

### 1) Combo Progression

- Within window increments.
- Expiry refreshes after each qualifying kill.
- Outside window resets to a new chain (`comboCount=1` after kill).
- `maxComboCount` tracks peak combo.

Primary code paths:

- `ScoreSystem.onEnemyKilled`
- `ScoreSystem.resetComboIfExpired`
- `ScoreSystem.computeNextComboCount`

Existing tests:

- `packages/games/space-blaster/src/scoring/ScoreSystem.spec.ts`
- `packages/games/space-blaster/src/scoring/ScoreSystem.ticket34.test.ts`

### 2) Tier Bonus One-Time Award

- Tier bonus granted once on tier entry.
- No repeat award while staying in same tier.
- Award can be re-earned after reset and re-entry.

Primary code paths:

- `ScoreSystem.computeTierEntryBonus`
- `ScoreSystem.onEnemyKilled`

Existing tests:

- `packages/games/space-blaster/src/scoring/ScoreSystem.spec.ts`
- `packages/games/space-blaster/src/scoring/ScoreSystem.ticket34.test.ts`

### 3) Combo Expiry/Reset

- Time expiry reset (`EXPIRED`).
- `resetOnPlayerHit=true` resets combo.
- `resetOnPlayerHit=false` preserves combo.

Primary code paths:

- `ScoreSystem.resetComboIfExpired`
- `ScoreSystem.onPlayerHit`
- `ScoreSystem.resetComboState`

Existing tests:

- `packages/games/space-blaster/src/scoring/ScoreSystem.spec.ts`

### 4) Multiplier Clamp

- Level 1 uses base multiplier.
- High levels clamp at max.
- Kill point rounding verifies clamp result in final points.

Primary code paths:

- `computeLevelMultiplier`
- `ScoreSystem.onEnemyKilled`

Existing tests:

- `packages/games/space-blaster/src/scoring/ScoreSystem.spec.ts`
- `packages/games/space-blaster/src/scoring/ScoreSystem.ticket34.test.ts`

### 5) Accuracy Thresholds

- `shotsFired=0` edge case is safe.
- Highest threshold met selected.
- `finalizeRun` one-time bonus application.
- No penalties (no negative bonus path).

Primary code paths:

- `computeAccuracy`
- `selectHighestAccuracyThreshold`
- `ScoreSystem.finalizeRun`

Existing tests:

- `packages/games/space-blaster/src/scoring/ScoreSystem.spec.ts`
- `packages/games/space-blaster/src/scoring/ScoreSystem.ticket35.test.ts`

### Wave Bonus Coverage (Ticket Scope)

- Base-only and base+per-life scenarios.
- Idempotent per wave clear key.
- `breakdownTotals.waveClearBonuses` increments and participates in invariant sum.

Primary code paths:

- `ScoreSystem.onWaveCleared`

Existing tests:

- `packages/games/space-blaster/src/scoring/ScoreSystem.spec.ts`
- `packages/games/space-blaster/src/scoring/ScoreSystem.ticket35.test.ts`

## Recommended Test Implementation Approach

- Pure logic unit tests:
  - `computeLevelMultiplier`
  - `selectHighestComboTier`, `computeComboTierIndex`
  - `computeAccuracy`, `selectHighestAccuracyThreshold`
- ScoreSystem deterministic unit tests:
  - explicit `nowMs` and direct method calls (`onEnemyKilled`, `onWaveCleared`, `finalizeRun`)
  - assert state fields + breakdown buckets + event log
- Integration-ish bus tests:
  - emit `RUN_EVENT.*` into a real `RunEventBus`
  - verify ScoreSystem subscriptions map events to state updates
- Shared fixtures:
  - baseline resolved config fixture with overridable score knobs
  - helper for deterministic level number provider

## Matrix To Code Path Mapping

- Combo/tier paths: `packages/games/space-blaster/src/scoring/ScoreSystem.ts` (`onEnemyKilled`, `computeNextComboCount`, `computeTierEntryBonus`, `resetComboIfExpired`)
- Clamp paths: `packages/games/space-blaster/src/scoring/ScoreSystem.ts` (`computeLevelMultiplier`)
- Accuracy paths: `packages/games/space-blaster/src/scoring/ScoreSystem.ts` (`computeAccuracy`, `selectHighestAccuracyThreshold`, `finalizeRun`)
- Wave bonus/idempotency: `packages/games/space-blaster/src/scoring/ScoreSystem.ts` (`onWaveCleared`, `appliedWaveBonusKeys`)
- Breakdown model: `packages/games/space-blaster/src/scoring/ScoreState.ts`

## Actionable Checklist

- [ ] Matrix scenarios are represented in `ScoreSystem.spec.ts` and ticket specs.
- [ ] Edge/failure cases are covered (expiry boundaries, clamp extremes, idempotency repeats).
- [ ] Tests assert `breakdownTotals` buckets, not just final score.
- [ ] Bus-driven integration-ish test covers event subscription wiring.
