# Space Blaster Immutability Semantics Test Plan

## Purpose

Verify the freeze-per-run behavior:

- active run keeps the captured config (`configHash`) for the full run
- publish of a new bundle does not affect the active run
- restart/new run picks up the newly published bundle

## Preconditions

1. Install deps:

```bash
pnpm install
```

2. Start required services (3 terminals):

```bash
pnpm nx run admin:dev
pnpm nx run web:dev
pnpm nx serve realtime
```

3. Set web env so game/runtime API calls resolve to admin API:

```bash
# apps/web/.env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_REALTIME_WS_URL=ws://localhost:4000
```

4. Useful endpoints:

- Runtime resolver (current pointer): `GET http://localhost:3001/api/space-blaster/runtime?env=dev`
- Runtime resolver (explicit version): `GET http://localhost:3001/api/space-blaster/runtime?env=dev&versionId=<id>`
- Publish bundle: `POST http://localhost:3001/api/space-blaster/publish?env=dev`

## Test data setup (Config A / Config B)

This publish flow builds bundle content from sample files in:

- `packages/types/src/space-blaster/samples/v1/*.json`

Use:

- **Config A**: current samples as-is
- **Config B**: modify one visible field in samples (for example enemy HP in `enemy-catalog.v1.json`), then republish

Expected: `configHash` changes from A to B.

## Procedure

### 1) Ensure Config A is active

Run:

```bash
curl -X POST "http://localhost:3001/api/space-blaster/publish?env=dev"
curl "http://localhost:3001/api/space-blaster/runtime?env=dev"
```

Record:

- `versionId_A`
- `configHash_A`

Expected:

- publish returns HTTP 200 with `versionId` + `configHash`
- resolver returns same `versionId_A` and `configHash_A`

### 2) Start Space Blaster run on A

1. Open `http://localhost:3000/games/space-blaster`
2. Start a run (press space / begin gameplay)
3. In browser DevTools, Network tab, confirm resolver response used by game contains `configHash_A`

Expected:

- run starts successfully
- run is associated with `configHash_A`

### 3) Publish Config B while run is active

1. Modify one sample value in `packages/types/src/space-blaster/samples/v1/*.json`
2. Publish again:

```bash
curl -X POST "http://localhost:3001/api/space-blaster/publish?env=dev"
curl "http://localhost:3001/api/space-blaster/runtime?env=dev"
```

Record:

- `versionId_B`
- `configHash_B`

Expected:

- `configHash_B != configHash_A`
- resolver current pointer now returns B

### 4) Confirm active run continues on A

While the original run is still active:

- continue playing without restart/remount
- verify no mid-run config swap behavior

Expected:

- active run behavior remains consistent with A
- no mid-run switch to B

### 5) Restart/new run and confirm B is used

1. End run and start a new run (or remount page)
2. Check resolver response again and observe gameplay behavior tied to B change

Expected:

- new run uses `configHash_B`
- visible behavior reflects Config B

## Expected outcomes summary

- Resolver current pointer changes A -> B after publish.
- Active run started under A stays on A until run end.
- New run after restart/remount uses B.
- Old bundle remains fetchable by explicit `versionId_A`.

## Troubleshooting

- If publish fails:
  - check `apps/admin/src/app/api/space-blaster/publish/route.ts` logs and response body
- If resolver returns 404:
  - publish at least once first
- If config hash is unclear in UI:
  - use resolver endpoint responses in Network/curl as source of truth
- If active run appears to change mid-session:
  - inspect freeze logic in `packages/games/space-blaster/src/runtime/run-context.ts`

## Optional automation outline

If adding E2E later (Playwright/Nx e2e):

1. Publish A, capture hash
2. Start game run
3. Publish B, capture hash
4. Assert active run remains on A (no remount)
5. Trigger new run/remount
6. Assert new run uses B
