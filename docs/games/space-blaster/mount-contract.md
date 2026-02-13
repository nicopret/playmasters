# Space Blaster Mount Contract (Public)

## Overview

This contract defines how a Playmasters host mounts and unmounts Space Blaster in a DOM container, and how resolved config is handled for run integrity.

Primary implementation:

- `packages/games/space-blaster/src/game.ts`
- public game export: `packages/games/space-blaster/src/index.ts`

Shared types:

- `EmbeddedGame`: `packages/types/src/game.ts`
- `GameSdk`: `packages/games-sdk/src/types.ts`
- resolved config contract: `ResolvedGameConfigV1` in `packages/types/src/space-blaster/runtime/resolved-v1.ts`

## Exact API (from code)

```ts
type EmbeddedGame = {
  mount: (opts: {
    el: HTMLElement;
    sdk: GameSdk;
    resolvedConfig?: unknown; // Space Blaster requires this at runtime
    onReady?: () => void;
    onGameOver?: (finalScore: number) => void;
  }) => { destroy: () => void };
};
```

Space Blaster export:

```ts
export const spaceBlaster: EmbeddedGame;
```

Operational equivalent requested by integrators:

```ts
const instance = spaceBlaster.mount({
  el: container,
  sdk,
  resolvedConfig,
});
const unmount = () => instance.destroy();
```

## Inputs: required vs optional

- `el` (required): owned host container where Phaser mounts.
- `sdk` (required): runtime SDK for `startRun()` and `submitScore(...)`.
- `resolvedConfig` (required by Space Blaster runtime): resolved runtime bundle payload. Mount throws if missing.
- `onReady` (optional): callback when scene create lifecycle completes.
- `onGameOver` (optional): callback with `finalScore`.

Resolved config expected shape (when provided):

- `configHash` (and optional `versionHash`, `versionId`, `publishedAt`)
- `gameConfig`
- `levelConfigs`
- `heroCatalog`
- `enemyCatalog`
- `ammoCatalog`
- `formationLayouts`
- `scoreConfig`

Reference type: `ResolvedGameConfigV1`.

## Guarantees and lifecycle

### When config is captured

- Config is captured at mount input time into a per-mount `RunContext`.
- `RunContext` captures immutable active identifiers:
  - `configHash` (required)
  - `versionHash` (if provided)
  - `versionId` / `publishedAt` (if provided)
- Space Blaster does not re-resolve config pointers during an active mounted run.
- Source: `packages/games/space-blaster/src/runtime/run-context.ts`.

### Frozen per run (operational definition)

For an active run/session:

- Use the same resolved config version/hash captured for that mount/run lifecycle.
- Do not mutate the resolved config object at runtime.
- Incoming updates are staged as pending for next run and never swap active config.
- Publish/rollback pointer changes affect only future mounts/runs, not already-active runs.

This matches the runtime and docs contract used for competitive integrity.

## Immutability rules for active runs

- Active run inputs are treated as immutable.
- `resolvedConfig` should be treated as read-only by host and game systems.
- If a new bundle is published or rollback happens mid-session, active runs continue on their captured config; only new runs should use the new bundle.
- Active reference is frozen: `ctx.resolvedConfig` and `ctx.configHash` stay unchanged for the mounted run.

### Pending update hook (next-run UX)

Space Blaster exposes helper APIs for hosts that receive “new config available” events:

- `applyIncomingConfigUpdate(ctx, nextResolvedConfig, onPendingUpdateDetected?)`
  - If hash differs, records `pendingResolvedConfig` / `pendingConfigHash`.
  - Does **not** replace active `resolvedConfig`.
- `resolveConfigForNextRun(ctx)`
  - Returns pending config when present; otherwise current config.

This enables a host UX message like: “New update available next run.”

## Error handling

If `resolvedConfig` is missing or fails validation:

- mount throws an error (formatted from validation issues)
- error includes actionable domain/path/message details
- host must catch and render an ERROR UI state

Validation source:

- `packages/games/space-blaster/src/runtime/run-context.ts`

## Example host integration

```ts
import { spaceBlaster } from '@playmasters/space-blaster';
import type { GameSdk, ResolvedGameConfigV1 } from '@playmasters/types';

function mountSpaceBlaster(
  container: HTMLElement,
  sdk: GameSdk,
  resolvedConfig: ResolvedGameConfigV1,
) {
  const instance = spaceBlaster.mount({
    el: container,
    sdk,
    resolvedConfig,
  });

  return {
    unmount() {
      instance.destroy();
    },
  };
}
```

## Versioning

- Current runtime config contract: `ResolvedGameConfigV1`
- Breaking changes should ship as `ResolvedGameConfigV2` while keeping V1 available for compatibility.

## How to verify freeze semantics

- Unit verification (automated):
  - `packages/games/space-blaster/src/runtime/run-context.spec.ts`
  - proves active run config/hash are frozen and pending updates are staged for next run only
- Manual verification (reproducible ops flow):
  - `docs/test-plans/space-blaster-immutability-semantics.md`
  - covers A-run active, publish B, active run stays on A, restart picks B
