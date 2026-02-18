# Run Lifecycle Integration Test Matrix (Space Blaster)

## Purpose

Define deterministic, implementable integration coverage for run lifecycle behavior using the existing headless harness and real state machines.

Primary references:

- `packages/games/space-blaster/src/run/RunStateMachine.ts`
- `packages/games/space-blaster/src/overlay/OverlayStateMachine.ts`
- `packages/games/space-blaster/src/runtime/OverlayCoordinator.ts`
- `packages/games/space-blaster/src/run/__tests__/harness/RunHarness.ts`

## Glossary

- `sim clock`: simulated time advanced only through harness ticks (`h.tick(dtMs)`), not wall-clock.
- `run context`: the mutable `RunContext` object used for run registration/submission/config hash and submission status.
- `overlay blocking`: `OverlayCoordinator` reports `blocksGameplay=true` when overlay state is `PAUSED`, `SETTINGS`, or `RESULTS`; simulation should not advance.
- `wave clear`: transition path triggered from `PLAYING` when `LevelSystem` requests `runStateMachine.requestWaveClear()` (or force wave clear), leading to `WAVE_CLEAR`.
- `respawn`: player-death path from `PLAYING` into `PLAYER_RESPAWN`, then back through `COUNTDOWN` to `PLAYING`.

## Canonical States and Events (No Invented Names)

### Run states (`RunState`)

- `BOOT`
- `READY`
- `COUNTDOWN`
- `PLAYING`
- `PLAYER_RESPAWN`
- `WAVE_CLEAR`
- `LEVEL_COMPLETE`
- `RUN_ENDING`
- `SUBMITTING`
- `RESULTS`
- `ERROR`

### Run requests / events

- Requests: `requestBootComplete()`, `requestStart()`, `requestPlayerDied()`, `requestWaveClear()`, `requestEndRun(reason)`, `requestSubmissionComplete()`
- Bus events used by systems/assertions: `RUN_EVENT.LEVEL_WAVE_CLEARED`, `RUN_EVENT.STATE_CHANGED`

### Overlay states (`OverlayState`)

- `NONE`
- `PAUSED`
- `SETTINGS`
- `RESULTS`

### Overlay actions (`OverlayStateMachine.dispatch` via coordinator)

- `TOGGLE_PAUSE`
- `OPEN_SETTINGS`
- `CLOSE_SETTINGS`
- `SHOW_RESULTS`
- `HIDE_RESULTS`

## Deterministic Timing Guidance

Always drive lifecycle with harness sim ticks (`h.tick(ms)`). Do not use `setTimeout`, `Date.now`, or polling loops.

Use machine/harness timing constants (from `RunHarness`/machine config) for deterministic expectations:

- `countdownMs`: `100`
- `respawnDelayMs`: `40`
- `waveClearMs`: `60`
- `levelCompleteMs`: `80`
- `runEndingDelayMs`: `50`
- `submittingTimeoutMs`: `120`

## Harness Assumptions

Use `makeRunHarness()` and drive real state machines/systems through public helpers.

Recommended helper usage (existing names):

- `bootToReady()`
- `startRun()`
- `tick(ms)`
- `setActiveEnemyCount(count)` + `triggerWaveClearByEnemyDepletion()`
- `pause()` / `resume()`
- `endRunGameOver()`
- `restartRun()` / `restartFromOverlay()`
- `flushAsync()`

If writing higher-level wrappers in new tests, keep them thin wrappers around these methods:

- `advanceSim(ms)` -> `tick(ms)`
- `startRunToPlaying()` -> `bootToReady(); startRun()`
- `clearWave()` -> `setActiveEnemyCount(0); tick(16); tick(0)`
- `hitPlayer()` -> `runStateMachine.requestPlayerDied(); tick(0)`
- `restart()` -> `restartRun()` or `restartFromOverlay()` depending scenario

## Required Fakes / Mocks

Use harness-internal deterministic fakes and avoid network/runtime side effects:

- Fake SDK (`startRun`, `submitScore`) via harness `submissionBehavior` (`resolve`/`reject`/`never`).
- Fake resolved config fixture via `createMinimalResolvedConfig` (or explicit `initialResolvedConfig`).
- Deterministic enemy depletion by controlling `setActiveEnemyCount`.
- Overlay through `OverlayCoordinator` methods (`pause`, `resume`, `openSettings`, `closeSettings`, `restartFromOverlay`).
- Keep rendering headless (no Phaser renderer assertions).
- RNG: do not rely on random outcomes; prefer fixed fixture data and direct event forcing.

## Scenario Matrix

| ID       | Scenario                                 | Preconditions                                                                                                                   | Actions (deterministic)                                                                                                                                                                   | Expected transitions                                                                                                          | Key assertions                                                                                                                                                                                                                                                               |
| -------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RL-HP-01 | Start -> play -> wave clear -> next wave | Harness with default config (`>=2` waves), `submissionBehavior='resolve'`; run at `READY`                                       | 1) `bootToReady()` 2) `startRun()` 3) ensure wave0 active 4) force depletion (`setActiveEnemyCount(0)` + `tick(16)` + `tick(0)`) 5) `tick(60)` 6) `tick(100)`                             | `BOOT -> READY -> COUNTDOWN -> PLAYING -> WAVE_CLEAR -> COUNTDOWN -> PLAYING`                                                 | `levelSystem.getWaveIndex()` increments `0 -> 1`; `startedWaves` includes wave0 and wave1; `RUN_EVENT.LEVEL_WAVE_CLEARED` captured once with expected payload; gameplay resumes in `PLAYING`                                                                                 |
| RL-EC-02 | Start -> death -> respawn                | Harness in `PLAYING`; lives > 1                                                                                                 | 1) `bootToReady(); startRun()` 2) trigger death (`runStateMachine.requestPlayerDied(); tick(0)`) 3) `tick(40)` respawn delay 4) `tick(100)` countdown                                     | `... PLAYING -> PLAYER_RESPAWN -> COUNTDOWN -> PLAYING`                                                                       | Transition log contains respawn path; while respawning, sim gameplay actions are blocked; invulnerability window behavior validated via life system in integration assertion plan (`lifeSystem.invulnerable` or equivalent observable gate)                                  |
| RL-EC-03 | Last life -> game over -> results        | Harness in `PLAYING`; model last-life condition (either via repeated deaths to exhaustion or direct end-run reason `game_over`) | 1) `bootToReady(); startRun()` 2) trigger game-over path (`endRunGameOver()` or equivalent last-life depletion) 3) `tick(50)` 4) `flushAsync()` + `tick(0)` (or `tick(120)` timeout case) | `... PLAYING -> RUN_ENDING -> SUBMITTING -> RESULTS`                                                                          | Results reached deterministically; `scoreSystem.finalizeRun(simNowMs)` called on `RUN_ENDING`; submission status transitions (`submitting` then `success`/`fail` or stays `submitting` until timeout) without blocking `RESULTS`; overlay sync enters `OverlayState.RESULTS` |
| RL-EC-04 | Pause / resume blocks simulation         | Harness in `PLAYING`                                                                                                            | 1) `bootToReady(); startRun(); tick(50)` 2) capture `simNowMs`/advanceCount 3) `pause(); tick(1000)` 4) optional `openSettings(); tick(500); closeSettings()` 5) `resume(); tick(25)`     | Run state remains `PLAYING`; overlay `NONE -> PAUSED -> SETTINGS -> PAUSED -> NONE` (if settings path used)                   | `simNowMs` and simulation advance count do not change while paused/settings; both resume immediately after `resume`; no desync in run state                                                                                                                                  |
| RL-EC-05 | Restart resets run context/baseline      | Harness with stable baseline snapshot                                                                                           | Variant A (hard restart): `restartRun()` loop after activity. Variant B (overlay restart): while paused or results, `restartFromOverlay()` then progress to new countdown/play            | Restart path returns to new run boundary (`RESULTS -> COUNTDOWN -> PLAYING` for overlay path, fresh machine for hard restart) | New `RunContext` instance created; `runId` unset until registration; submission status reset to idle; pools/listeners return to baseline; score/lives/wave progression reset (`wavesCleared=0`, wave index reset)                                                            |

## Acceptance Coverage Mapping

- `start -> play -> wave clear -> next wave`: `RL-HP-01`
- `start -> death -> respawn`: `RL-EC-02`
- `last life -> game over -> results`: `RL-EC-03`
- `pause/resume`: `RL-EC-04`
- `restart`: `RL-EC-05`

## Assertion Focus Checklist (Per Scenario)

For each implemented integration test, include assertions from all relevant buckets:

- State machine transitions:
  - `RUN_EVENT.STATE_CHANGED` sequence and terminal state
  - overlay state transitions when applicable
- RunContext:
  - registration/submission flags and status
  - context replacement on restart
- Level/wave progression:
  - `waveIndex`, `startedWaves`, `waveClearedEvents`
- Score hooks:
  - wave clear bonus trigger path (`LEVEL_WAVE_CLEARED` -> score side effects)
  - finalization on run end (`finalizeRun` path)
- Freeze semantics:
  - `simNowMs` and sim advance count unchanged under blocking overlay
- Resource hygiene on restart:
  - pool metrics baseline
  - listener count stability

## Mapping to Planned Test Files (#183 / #184)

Planned split aligned to existing harness and current test organization:

- `packages/games/space-blaster/src/run/__tests__/runLifecycle.happy.integration.test.ts`
  - `RL-HP-01`
- `packages/games/space-blaster/src/run/__tests__/runLifecycle.edge.integration.test.ts`
  - `RL-EC-02`, `RL-EC-03`, `RL-EC-05`
- `packages/games/space-blaster/src/run/__tests__/overlayBlocking.integration.test.ts`
  - `RL-EC-04`

Current nearest files already covering parts of this matrix:

- `runLifecycle.integration.test.ts`
- `runEdgeCases.integration.test.ts`
- `overlayBlocking.integration.test.ts`
- `freezeSemantics.integration.test.ts`
