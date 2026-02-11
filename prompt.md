You are working in the nicopret/playmasters Nx/workspaces monorepo.

Implement GitHub Issue #64:

Goal
Create JSON schema for catalogs (HeroCatalog, EnemyCatalog, AmmoCatalog).

Acceptance tests
1) Each entry requires stable id fields (heroId/enemyId/ammoId).
2) Stats are typed and bounded (hp > 0, cooldown >= 0, speed >= 0).
3) Visual/audio keys are typed consistently across catalogs.

Repository constraints
- Use the repo’s existing schema validation tooling (likely Ajv + JSON Schema draft 2020-12, but confirm by searching).
- Place schemas in the canonical shared location used for config contracts (prefer @playmasters/types under packages/types, mirroring existing schema locations if present).
- Schemas must be strict: additionalProperties: false where reasonable to prevent silent typos.
- Keep changes additive and backward compatible where possible.
- Ensure schemas are wired into the “schema validation” stage of the publish pipeline (or the existing validator entrypoint) if such a stage exists.

Tasks
1) Discover existing schema conventions
   - Search for Ajv/JSON Schema usage and existing schema files:
     - git grep -n "ajv|JSONSchema|draft/2020-12|\\.schema\\.json" packages
   - Identify where other Space Blaster schemas live (or create a new folder consistent with conventions).

2) Add three JSON schema files
   - hero-catalog.schema.json
   - enemy-catalog.schema.json
   - ammo-catalog.schema.json

   Requirements for all three:
   - Root type: object
   - additionalProperties: false
   - Must define an “entries” container consistent with how catalogs are represented in this repo (either an array of entries or a map keyed by id). Inspect existing code/fixtures to match the actual shape.
   - Visual/audio keys must use the same definition across schemas via $defs:
     - spriteKey: string, minLength 1
     - sfxKey/musicKey/etc as applicable: string, minLength 1
   - IDs:
     - hero entry requires heroId (string, minLength 1)
     - enemy entry requires enemyId (string, minLength 1)
     - ammo entry requires ammoId (string, minLength 1)

   Stats bounds:
   - Enemy entry:
     - hp: integer, minimum 1 (hp > 0)
   - Ammo entry:
     - cooldown: number or integer (match existing types), minimum 0
     - speed: number or integer, minimum 0
   - Any other numeric stats present in the current catalog shapes should be typed and given reasonable non-negative bounds if they represent rates/amounts.

3) Consistent key typing across catalogs
   - Define shared $defs in each schema (or a shared referenced schema if repo supports it) so sprite/audio keys are identical:
     - $defs.assetKey: { "type": "string", "minLength": 1 }
     - Use it for spriteKey and audio keys consistently.
   - If catalogs use slightly different field names, keep field names but ensure the schema definitions refer to the same $defs type.

4) Export schemas via an index
   - Add/extend an index.ts that exports these schemas (or a JSON schema registry object), matching existing patterns.
   - If the repo compiles schemas at runtime, ensure these new schemas are registered.

5) Wire into validation (if present)
   - Locate schema validation stage used by Admin/publish pipeline.
   - Ensure HeroCatalog/EnemyCatalog/AmmoCatalog payloads are validated against these new schemas.
   - Schema validation should be publish-blocking and must return structured errors with:
     - stage: "schema"
     - domain: "HeroCatalog"/"EnemyCatalog"/"AmmoCatalog"
     - path: Ajv instancePath converted to a readable path
     - message: Ajv message

6) Add fixtures + tests
   - Create minimal valid fixtures for each catalog.
   - Create invalid fixtures that specifically fail each acceptance test:
     - missing heroId/enemyId/ammoId
     - hp = 0 or negative
     - cooldown = -1
     - speed = -1
     - spriteKey missing or wrong type (e.g., number)
   - Add unit tests that:
     - validate valid fixtures pass
     - validate invalid fixtures fail and error paths/messages are meaningful

7) Verify
   - Run the repo’s lint/test/typecheck targets relevant to the schema package and validator pipeline.
   - Ensure no changes to unrelated dependencies.

Deliverables
- Three JSON schema files implementing the acceptance criteria.
- Any registry/index updates to expose schemas.
- Validation wiring (if pipeline exists).
- Tests + fixtures demonstrating acceptance criteria.

Output required from you at the end
- List of files changed/added.
- Commands to run tests/validation.
- Brief mapping of acceptance criteria → implementation proof.
