# Space Blaster Freeze Semantics Test Plan

## Scope

Validate freeze-per-run behavior:

- a run captures a config snapshot (`resolvedConfig` + `configHash`/`versionHash`) at start
- active gameplay does not swap that snapshot mid-run
- newly published config applies only on next run/restart

## Preconditions / Setup

1. Run the game in dev with Space Blaster host page enabled.
2. Ensure admin publish flow is available (or a deterministic test endpoint/stub that can return a new runtime bundle hash).
3. Capture the active config hash from one of:
   - network response body from `/api/space-blaster/runtime?env=dev` (`bundle.configHash`)
   - runtime debug log / diagnostics if enabled
4. Confirm baseline runtime returns `configHash = A`.

## Manual Scenario 1: Freeze During Active Run

1. Start a run and reach `PLAYING`.
2. Record active run hash `A`.
3. While still `PLAYING`, publish/update runtime config so resolver now returns `configHash = B`.
4. Keep playing without restarting.

Expected:

- current run stays on hash `A`
- no mid-run config swap is observed
- if update messaging is enabled, you may see: `New update available. It will apply next run.`

## Manual Scenario 2: Restart Picks Up Latest

1. Finish run and reach `RESULTS`.
2. Restart/start a new run.
3. Capture active run hash for the new run.

Expected:

- new run uses hash `B`
- old run’s captured hash remains `A` in any previous run records/submission payloads

## Manual Scenario 3: Pause/Resume Does Not Swap Config

1. Start run with hash `A`.
2. Pause (or enter an overlay that freezes gameplay).
3. Publish/update config to hash `B` while paused.
4. Resume without restarting.

Expected:

- resumed run continues with hash `A`
- hash `B` is only applied after restart/new run

## Observability Notes

- Resolver endpoint: `/api/space-blaster/runtime?env=dev`
- Host-side update detection (polling) should not force active-run swap.
- Optional user-facing status: `New update available. It will apply next run.`

## Automated Coverage

- `packages/games/space-blaster/src/run/__tests__/freezeSemantics.integration.test.ts`
  - validates no mid-run config swap
  - validates staged update applies on next run/restart path
