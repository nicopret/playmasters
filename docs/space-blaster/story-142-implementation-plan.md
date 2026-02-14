# Story 142 / Ticket 32 Implementation Plan

## Story Summary

Prevent stalling by applying aggression when remaining enemies are low:

- when alive enemies <= threshold, formation speed ramps sharply
- completion should come from aggression (not primarily from a timeout)
- behavior is config-driven (`threshold`, `speedMultiplier`)

## Architecture Alignment

- `RunStateMachine` owns transitions.
- `SimulationGating` runs gameplay updates only in `PLAYING`.
- `LevelSystem` handles wave/level progression and wave-clear intents.
- `FormationSystem` owns formation motion and speed ramps.
- Config is read from `ctx.resolvedConfig` only.

## Components

### 1) Config Surface

- `ResolvedLevelConfigV1.stallAggression?: { threshold?: number; speedMultiplier?: number }`
- `level-config.schema.json` validates:
  - `threshold` integer >= 0
  - `speedMultiplier` number >= 1

### 2) Motion Logic

- `formation-motion.ts`
  - `computeStallAggressionTargetSpeed(...)` helper to derive aggression speed target.
- `FormationSystem.ts`
  - reads `level.stallAggression` on wave spawn
  - applies sharp speed override when alive <= threshold
  - keeps enrage timeout behavior as fallback only

### 3) Verification

- Unit tests in `formation-motion.spec.ts`:
  - threshold activation behavior
- Unit tests in `FormationSystem.spec.ts`:
  - sharp multiplier application
  - no required timeout dependency for stall aggression behavior

## Ownership / Integration Points

- `LevelSystem` does not mutate run state directly; it only requests transitions.
- `FormationSystem` computes speed each simulation tick and stays deterministic.
- Existing enrage timeout (`lastEnemiesEnrage`) remains optional fallback.

## Risks / Edge Cases

- If both `stallAggression` and `lastEnemiesEnrage` are configured, target speed precedence must be deterministic.
- If `threshold` is `0` or `speedMultiplier` is `1`, feature is effectively disabled.
- Aggression must not run while simulation is frozen (handled by existing sim gating).

## Reproducible Verification Plan

### Unit Tests

- Run:
  - `pnpm exec nx test space-blaster -- --runInBand`
- Relevant suites:
  - `packages/games/space-blaster/src/systems/formation-motion.spec.ts`
  - `packages/games/space-blaster/src/systems/FormationSystem.spec.ts`

### Manual Steps

1. In active level config, set:
   - `stallAggression.threshold = 3`
   - `stallAggression.speedMultiplier = 3`
2. Start a run and clear enemies until 3 remain.
3. Observe formation speed increase sharply at threshold.
4. Confirm wave finishes from pressure/aggression without needing timeout force clear.
5. Optional fallback check: if `lastEnemiesEnrage` timeout is configured, it should only act as backup.
