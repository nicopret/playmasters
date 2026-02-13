# Issue #130: Runtime resolved config type location

## Where source config types live today

- JSON Schemas (authoritative input contracts) live in `packages/types/src/space-blaster/schemas/`:
  - `game-config.schema.json`
  - `level-config.schema.json`
  - `score-config.schema.json`
  - `hero-catalog.schema.json`
  - `enemy-catalog.schema.json`
  - `ammo-catalog.schema.json`
  - `formation-layouts.schema.json`
- Schema registry and validation entrypoints live in:
  - `packages/types/src/space-blaster/schemas/index.ts`
  - `packages/types/src/space-blaster/schemas/validateSchema.ts`
- TypeScript config-domain shapes are currently split and mostly draft/editor-oriented:
  - `packages/types/src/image-editor.ts` (`LevelConfig` draft shape used by admin flows)
  - `apps/admin/src/lib/scoreConfig.ts` and `apps/admin/src/app/score-config/validateScoreConfigDraft.ts` (`ScoreConfigDraft`)
- Runtime resolver currently returns a loosely typed bundle payload from:
  - `apps/admin/src/app/api/space-blaster/runtime/route.ts`
  - backed by `apps/admin/lib/bundleStore.ts`

## Decision: canonical location for resolved runtime types

- Canonical location should be the shared types package: `packages/types`.
- Add resolved runtime contracts under:
  - `packages/types/src/space-blaster/runtime/`
- Re-export from:
  - `packages/types/src/index.ts`

Rationale:

- `packages/types` is already the shared cross-app contract package in this workspace.
- Runtime bundle contracts are consumed across boundaries (publish/admin/realtime/web), so they should not live inside one app.
- Keeping resolved contracts in the shared package prevents drift between resolver output and runtime consumers.

## Naming/versioning convention

- Use explicit versioned names for resolved contracts:
  - `ResolvedSpaceBlasterBundleV1`
  - `ResolvedGameConfigV1`
  - `ResolvedLevelConfigV1`
  - `ResolvedScoreConfigV1`
  - `ResolvedEnemyCatalogV1`, `ResolvedHeroCatalogV1`, `ResolvedAmmoCatalogV1`, `ResolvedFormationLayoutsV1`
- Keep input vs resolved names distinct:
  - input/schema-aligned: `GameConfigV1`, `LevelConfigV1`, etc.
  - runtime-resolved: `Resolved*V1`
- Version bump policy:
  - breaking runtime contract change -> add `V2` types and keep `V1` exports for compatibility
  - non-breaking additive fields can stay in current `V1` if consumers tolerate optional fields

## Next steps

- Add `packages/types/src/space-blaster/runtime/resolved-v1.ts` with the `Resolved*V1` contracts.
- Update `apps/admin/src/app/api/space-blaster/runtime/route.ts` response typing to return `ResolvedSpaceBlasterBundleV1`.
- Update runtime consumers to import resolved contracts from `@playmasters/types` only.
