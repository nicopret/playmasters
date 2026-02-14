# Story 142 Implementation Plan (Fallback: Story Text Missing)

## Discovery Result

- Requested source: GitHub issue `#142` story description.
- In-repo search did **not** find story content for `#142`.
- Closest related in-repo issue artifact found: `docs/space-blaster/resolved-bundle-system-checklist.md` (Issue `#141`).

Because the concrete feature text is missing, this document provides a structured implementation scaffold only. No feature-specific gameplay code is added here to avoid inventing requirements.

## What Was Searched

- `rg -n "#142|issue 142|Ticket 142|story 142|task 142" -S .`
- `rg -n "Backlog|Stories|Epics|142" docs packages .github -S`
- `rg -n "Issue #14[0-9]|Task #14[0-9]|Story #14[0-9]" docs packages . -S`
- `git log --oneline --all --grep "#142\\|142"`

## Architecture Alignment Notes

- Run state ownership remains in `RunStateMachine` (`packages/games/space-blaster/src/run`).
- Gameplay simulation ticks only when `RunState.PLAYING` (`SimulationGating`).
- Wave/level progression ownership remains in `LevelSystem`.
- Formation ownership remains in `FormationSystem`.
- Enemy local behavior ownership remains in enemy systems/controllers.
- Cross-system communication should use `RunEventBus` typed events.
- Runtime config source must remain `ctx.resolvedConfig` only (no runtime fetches).

## Component Breakdown Scaffold (To Fill Once Story Text Is Available)

1. Story Summary

- Source issue text: **TBD (missing in repo)**.
- Target behavior: **TBD**.

2. Modules and Responsibilities

- `packages/games/space-blaster/src/run/*`
  - Add/extend run intents or states only if story requires.
- `packages/games/space-blaster/src/levels/LevelSystem.ts`
  - Progression/intents only; no direct state mutation.
- `packages/games/space-blaster/src/systems/*`
  - Feature system integration points **TBD**.
- `packages/games/space-blaster/src/enemies/*`
  - Enemy behavior integration points **TBD**.
- `packages/games/space-blaster/src/game.ts`
  - Orchestration hookup only; preserve sim gating.

3. Data Types and Events

- Additive, typed bus events under `RUN_EVENT` as needed.
- Event payload fields:
  - source owner system
  - deterministic reason enum
  - relevant progression identifiers (level/wave/enemy ids)

4. Single-Owner Rules

- Run transitions: `RunStateMachine` only.
- Progression indices: `LevelSystem` only.
- Formation transform/slots: `FormationSystem` only.
- Detached enemy movement: enemy controller/system only.

## Incremental Implementation Steps (Template)

1. Add/extend types and bus events.
2. Add pure helper logic (unit-testable).
3. Integrate into owning runtime system.
4. Wire orchestration in `game.ts`.
5. Add unit/integration-ish tests (Phaser-free where possible).
6. Verify lint/test/build/format.

## Risks and Edge Cases (Template)

- Duplicate transition requests in same frame.
- Event ordering between wave/level transitions and system resets.
- Frozen simulation behavior outside PLAYING.
- Backward compatibility with existing resolved config fixtures.

## Verification Plan

### Unit Tests (Minimum)

- Pure helper behavior for new feature math/selection/state rules.
- Intent emission debounce and reason correctness.
- State progression invariants for affected systems.

### Manual Verification (Minimum)

1. Start run from READY to PLAYING.
2. Trigger feature path in gameplay.
3. Confirm expected state/events in debug logs or assertions.
4. Confirm no updates occur while not PLAYING.
5. Confirm no regressions in wave progression and run ending.

### Commands

- `pnpm exec nx lint space-blaster`
- `pnpm exec nx test space-blaster -- --runInBand`
- `pnpm exec nx build space-blaster`
- `pnpm exec nx format:check --files="docs/space-blaster/story-142-implementation-plan.md"`

## Blocking Note

Issue `#142` cannot be implemented feature-complete from repository-local context because its actual story text is missing. Once issue text is available in-repo (or provided directly), this scaffold can be converted into a concrete implementation plan and code changes.
