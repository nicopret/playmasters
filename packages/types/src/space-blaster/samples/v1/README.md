# Space Blaster v1 Sample (Golden Set)

These are minimal but complete sample configs that **must validate** against the Space Blaster schemas. Use them as a golden set for CI and for quick local validation.

## Files
- `game-config.v1.json`
- `level-1.v1.json`
- `level-2.v1.json`
- `level-3.v1.json`
- `hero-catalog.v1.json`
- `enemy-catalog.v1.json`
- `ammo-catalog.v1.json`
- `formation-layouts.v1.json`
- `score-config.v1.json`

## Validate locally

```bash
pnpm nx test types
```

The `samples.v1.spec.ts` test validates every file above against the corresponding schema and enforces the required minimum set (3 levels, catalogs present, 2 layouts, etc.).
