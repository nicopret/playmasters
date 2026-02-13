# Space Blaster Resolved Config Example

For local development, docs, and tests, use the typed fixture exported from:

- `@playmasters/types` (runtime export)
- source file: `packages/types/src/space-blaster/runtime/fixtures/resolved-config.example.ts`

## Import

```ts
import { resolvedConfigExample } from '@playmasters/types';
```

## Purpose

- Demonstrates the full `ResolvedGameConfigV1` contract in one self-contained object.
- Includes `configHash` and `versionHash` metadata.
- Keeps referenced IDs consistent across domains (`levelConfigs`, catalogs, and formation layouts).

## Sync guarantee

The fixture is type-checked at compile time and validated by runtime guard tests in:

- `packages/types/src/space-blaster/runtime/fixtures/resolved-config.example.spec.ts`
