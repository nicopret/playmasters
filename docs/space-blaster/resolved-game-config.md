# Space Blaster ResolvedGameConfig Contract

## Purpose

`ResolvedGameConfigV1` is the single runtime contract delivered to Space Blaster at mount/start.  
It is self-contained and includes all gameplay domains needed by the client runtime.

Canonical type:

- `packages/types/src/space-blaster/runtime/resolved-v1.ts`
- `packages/types/src/space-blaster/runtime/domains-v1.ts`

## Required Domains

`ResolvedGameConfigV1` includes:

- `gameConfig`
- `levelConfigs`
- `heroCatalog`
- `enemyCatalog`
- `ammoCatalog`
- `formationLayouts`
- `scoreConfig`
- `configHash`
- `versionHash` (resolver includes this on successful responses)

Optional metadata:

- `versionId`
- `publishedAt`
- `env`
- `gameId`

## Resolution Rules

Resolver output is self-contained:

- `levelConfigs[*].formationLayout` embeds the referenced layout object.
- `levelConfigs[*].waves[*].enemy` embeds the referenced enemy object.
- `levelConfigs[*].enemyTypesResolved` embeds enemy entries for `enemyTypes`.
- `levelConfigs[*].hero` and `levelConfigs[*].heroAmmo` embed hero/ammo when `heroId` is present.

If references are missing, resolver fails safely with structured errors:

- `MISSING_POINTER`
- `MISSING_PUBLISHED_BUNDLE`
- `MISSING_LAYOUT`
- `MISSING_ENEMY`
- `MISSING_HERO`
- `MISSING_AMMO`

## Hash Semantics

- `configHash` is the canonical SHA-256 hash of bundle content.
- `versionHash` is treated as equivalent to `configHash` in v1.
- Resolver uses publish-stored hashes when present.
- Resolver computes deterministic fallback hashes when missing.
- Hash computation excludes `configHash`/`versionHash` self-fields.

## Mutability Rules

- Runtime treats resolved config as read-only.
- `RunContext` captures `configHash` and `versionHash` at run start (`runConfigHash`, `runVersionHash`).
- Active run config is frozen per run (`RunContext.resolvedConfig` snapshot).
- Publish/rollback affects new runs only.
- Active runs continue using captured hashes and config.
- Incoming config updates are staged as `pendingResolvedConfig` and apply only to the next run.

## Update While Open

- Host-side `GameHost` polls the runtime resolver for Space Blaster (`/api/space-blaster/runtime?env=dev`).
- If a new `configHash` is detected, it stages that bundle for the next run and shows a non-blocking message: "New update available. It will apply next run."
- Active runs are not swapped mid-run.
- When the run reaches a non-active state (for example `RESULTS`), the host remounts with the staged bundle so restart/new run uses the latest published config.
