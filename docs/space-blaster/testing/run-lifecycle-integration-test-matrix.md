# Run Lifecycle Integration Test Matrix (Ticket #182 / #49)

## Scope

This matrix covers deterministic, Phaser-free lifecycle integration behavior using:

- `packages/games/space-blaster/src/run/RunStateMachine.ts`
- `packages/games/space-blaster/src/levels/LevelSystem.ts`
- `packages/games/space-blaster/src/run/SimulationGating.ts`
- `packages/games/space-blaster/src/runtime/run-registration.ts`
- `packages/games/space-blaster/src/runtime/run-submission.ts`
- Harness: `packages/games/space-blaster/src/run/__tests__/harness/RunHarness.ts`

## Runtime Semantics Covered

- RunStateMachine is the single owner of transitions.
- Simulation advances only when `state === PLAYING` and overlay blocking is false.
- Wave progression uses LevelSystem requests (`requestWaveClear`, then `COUNTDOWN`, then `PLAYING`).
- Submission side effects are non-blocking relative to `SUBMITTING -> RESULTS`.

## Determinism Rules

- No `Date.now()` and no wall-clock timers.
- Test clock progression is explicit via `h.tick(dtMs)`.
- No Phaser Scene/canvas/WebGL in integration tests.
- SDK is fully faked (`startRun`, `submitScore`) with deterministic behaviors.

## Matrix

| Area                    | Scenario                          | Trigger                                  | Expected                                                       |
| ----------------------- | --------------------------------- | ---------------------------------------- | -------------------------------------------------------------- |
| Startup                 | READY -> COUNTDOWN -> PLAYING     | `requestStart` + countdown ticks         | enters PLAYING deterministically                               |
| Death to results        | Start -> play -> death -> results | `requestEndRun('game_over')`             | reaches RUN_ENDING -> SUBMITTING -> RESULTS                    |
| Wave progression        | Wave clear to next wave           | enemy count reaches 0 while PLAYING      | enters WAVE_CLEAR, then next wave, returns PLAYING             |
| Pause/resume            | Freeze during pause               | overlay blocking true while PLAYING      | sim clock/value does not advance until resume                  |
| Restart cleanup         | Restart several times             | `restartRun()` loop                      | pools return baseline, new run context, listener counts stable |
| Submission non-blocking | submit never resolves             | fake SDK returns never-resolving promise | RESULTS still reached via SUBMITTING timeout                   |
| Submission fail         | submit rejects                    | fake SDK throws                          | RESULTS reached and failed status recorded                     |

## Coverage Mapping

- Startup path:
  - `packages/games/space-blaster/src/run/__tests__/runLifecycle.integration.test.ts`
  - test: `Start -> COUNTDOWN -> PLAYING transitions succeed`
- Death/results path:
  - `packages/games/space-blaster/src/run/__tests__/runLifecycle.integration.test.ts`
  - test: `Start -> play -> death -> results path passes`
- Wave clear/next wave:
  - `packages/games/space-blaster/src/run/__tests__/runLifecycle.integration.test.ts`
  - test: `Wave clear -> WAVE_CLEAR -> next wave -> PLAYING passes`
- Pause/resume freeze:
  - `packages/games/space-blaster/src/run/__tests__/runEdgeCases.integration.test.ts`
  - test: `Pause/resume freezes and resumes without desync`
- Restart cleanup + listener stability:
  - `packages/games/space-blaster/src/run/__tests__/runEdgeCases.integration.test.ts`
  - test: `2) restart resets pools/context and listener count remains stable across repeated restarts`
- Submission non-blocking (never resolves):
  - `packages/games/space-blaster/src/run/__tests__/runEdgeCases.integration.test.ts`
  - test: `3A) never-resolving submission does not block RESULTS`
- Submission failure path:
  - `packages/games/space-blaster/src/run/__tests__/runEdgeCases.integration.test.ts`
  - test: `3B) rejected submission records failed status and still reaches RESULTS`
