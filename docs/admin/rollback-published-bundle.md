# Rollback of Published Bundle (Space Blaster v1)

## What rollback is

Rollback repoints the **published pointer** for a given environment to a prior **published bundle version**. It does not edit artifacts; it simply moves the pointer to an existing immutable version.

## What rollback can target

- Target must be an existing published bundle version for the same environment.
- Version is identified by `versionId` (current implementation uses the bundle `configHash` as the versionId).
- Arbitrary/unknown versionIds are rejected.

## UX scope (v1)

- Published history list (versionId/configHash, timestamp, user, optional notes).
- Action: “Rollback to this version”.
- Confirmation modal: shows `currentVersion → targetVersion`, states “Affects new sessions only; active sessions remain unchanged.”
- Errors surfaced:
  - target not found
  - pointer conflict (another publish/rollback happened)
  - insufficient permissions

## Guarantees

1. **Rollback selects prior published version**
   - Endpoint validates the target exists in published history.
   - Pointer update is CAS-protected to avoid concurrent clobbering.

2. **Rollback does not delete artifacts**
   - Only the pointer is updated. No deletes or overwrites of existing versions.

3. **Active sessions unaffected**
   - Sessions should capture `versionId`/`configHash` at start and use fetch-by-version.
   - Resolver supports `GET /api/space-blaster/runtime?env=...&versionId=...` so older sessions can keep fetching their pinned version after rollback.

## API endpoints (current implementation)

- Publish bundle: `POST /api/space-blaster/publish?env=dev|staging|prod`
- Rollback bundle: `POST /api/space-blaster/rollback` with JSON `{ env, targetVersionId }`
- Runtime resolver:
  - Current pointer: `GET /api/space-blaster/runtime?env=...`
  - Specific version: `GET /api/space-blaster/runtime?env=...&versionId=...`
- Audit query: `GET /api/ops/audit-logs?entityId=<env>`

## Storage model (Space Blaster bundle)

- Table: `BUNDLE#<env>` partition.
  - Pointer: SK `POINTER` with `currentVersionId`.
  - Versions: SK `VERSION#<versionId>` immutable, includes `configHash`, `bundle`, `createdAt`.
- VersionId currently equals `configHash` for content-addressing/idempotency.
- Rollback updates pointer only; versions remain immutable and fetchable by versionId.

## Runtime contract

- New sessions use `GET /api/space-blaster/runtime` to get current `versionId` + `configHash`.
- Sessions should cache that `versionId` and, if needed, fetch via `versionId` to remain stable even after rollback.
