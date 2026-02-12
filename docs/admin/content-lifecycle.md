# Content Lifecycle (Draft → Publish) Cheat Sheet

This repo already wires the core Space Blaster / Playmasters content types through the draft → publish pipeline. Use this table to find the APIs and immutability guarantees.

## Content types and endpoints

| Type               | Draft API (GET/POST)                                                | Publish / Versioning                                                                                             | Current Published Fetch                   | Notes on storage                                                         |
| ------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------ |
| GameConfig         | `/api/games/[gameId]/levels/[levelId]` (includes game-level fields) | publish occurs via the same route after validation; creates new version record and repoints env pointer          | same route with GET when `published=true` | versioned records; published artifacts written under immutable versionId |
| LevelConfig        | `/api/games/[gameId]/levels/[levelId]`                              | publish step validates schema + structural + cross-ref/fairness, then writes immutable version and moves pointer | same route (published view)               | published item keyed by versionId; overwrite rejected                    |
| EnemyCatalog       | `/api/catalog/enemies` (draft load/save)                            | publish endpoint mirrors backgrounds pattern: writes immutable catalog version, updates env pointer              | `/api/catalog/enemies` (published list)   | published versions are append-only; versionId/hash based                 |
| HeroCatalog        | `/api/catalog/heroes`                                               | same flow as EnemyCatalog                                                                                        | `/api/catalog/heroes`                     | immutable published versions                                             |
| AmmoCatalog        | `/api/catalog/ammo`                                                 | same flow as EnemyCatalog                                                                                        | `/api/catalog/ammo`                       | immutable published versions                                             |
| FormationLayouts   | `/api/catalog/formation-layouts`                                    | publish writes versioned layouts set; pointer updated                                                            | `/api/catalog/formation-layouts`          | published layouts are immutable                                          |
| ScoreConfig        | `/api/score-config` (draft)                                         | publish creates new version after running score validators (#71 + readiness); pointer updated                    | `/api/score-config?published=true`        | published score configs are immutable                                    |
| Backgrounds/Assets | `/api/assets/[id]/save-draft`                                       | `/api/assets/[id]/publish` produces versioned asset                                                              | `/api/assets/[id]/versions`               | immutable by versionId                                                   |

## Immutability guardrails

- Published artifacts are keyed by `versionId`/hash and are append-only.
- API handlers reject writes that target an existing published `versionId` (409).
- Drafts remain editable; publishing always creates a new version and repoints the environment pointer.

## Validation on publish
- Schema validation runs for all types.
- LevelConfig: structural (#69), cross-reference (#68), fairness (#70).
- ScoreConfig: tier/structure (#71) plus client-side readiness (#86).
- Catalogs/Layout/GameConfig: schema + identifier integrity.
- Publish is blocked if any validator returns a `ValidationIssue`.

## How to publish (admin flow)

1. Edit draft via the relevant Admin page (or JSON editor where provided).
2. Fix inline errors; readiness must show “Ready to publish”.
3. Click Publish; backend re-validates and writes a new immutable version, then updates the environment pointer.

## Operational reminders

- To fetch a deterministic artifact, request by explicit `versionId`.
- Never mutate a published record; make changes in draft and publish a new version.
- If you see “immutable conflict” errors, you attempted to overwrite a published version. Create a new version instead.
