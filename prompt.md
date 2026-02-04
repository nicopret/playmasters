## Codex Prompt — Image Editor Phase 5: Publish, Rollback & Catalog Integration (Week 7–8)

**Task:** Implement Phase 5 of the Playmasters Image Editor: make edited images usable across the platform by enforcing asset types, integrating published backgrounds into level configuration selection, and adding usage indicators + safety checks to prevent breaking live content.

This phase assumes Phases 0–4 are completed:

* Asset library + versioning + publish/rollback exist
* Pixel editor exists (draft editing)
* Selection/mask exists
* OpenAI preview→accept creates new draft versions
* Publishing promotes to public bucket and sets `currentPublishedVersionId`

---

# Context / Repo assumptions

* Nx monorepo
* `apps/admin` is separate admin site
* There is some form of Level/Game config system underway or stubbed (even if basic). If level config isn’t implemented yet, create minimal **LevelConfig placeholder** model and endpoints sufficient to demonstrate background selection + usage tracking.
* S3 + Dynamo exist.
* Assets have `type` field: background | sprite | splash | ui
* Published assets have immutable URLs via `ASSETS_PUBLIC_BASE_URL`

---

# Goal

1. Enforce asset types so that backgrounds/splashes/UI are correctly handled and validated.
2. Provide a **Background Catalog** API to consume published background assets.
3. Update the game/level config admin UI so **published backgrounds are selectable** without redeploy.
4. Add usage indicators (“used by X levels”) and prevent deletion/unsafe actions for assets in use.
5. Ensure rollback fixes regressions instantly (pointer swap).

---

# Part 1 — Asset Type Enforcement

## 1) Enforce allowed types at the data layer and API

* Ensure all asset create/update endpoints validate:

  * `type` is one of: `background | sprite | splash | ui`
* Make type immutable once created (recommended for safety). If currently editable, lock it down.
* Extend metadata validation rules per type:

  * `background`: allow large dimensions, requires published URL when used
  * `splash`: enforce aspect ratio constraints if desired (optional)
  * `ui`: allow flexible
  * `sprite`: future; but still allow creation now

Add server-side validation on publish:

* If `asset.type === 'background'`, require:

  * PNG/WebP/JPG ok
  * max dimensions within configured bounds (e.g. 4096x4096)
* If `sprite`, require PNG with alpha (optional for now)

---

# Part 2 — Background Catalog (Read APIs)

## 2) Implement Catalog Read API in `apps/admin`

Create admin route handler:

* `GET /api/catalog/backgrounds`

Behavior:

* Return only **published** assets where `type === 'background'`
* Include:

  * `assetId`, `title`, `tags`, `width`, `height`
  * `publishedVersionId`
  * `publishedUrl` (derived from `ASSETS_PUBLIC_BASE_URL`)
  * `updatedAt`
* Add caching headers for this list (short TTL is fine in admin)

## 3) Implement public Content API in `apps/web`

To make backgrounds usable in the actual game runtime without redeploy, add in `apps/web`:

* `GET /api/catalog/backgrounds`

Same behavior as admin catalog, but:

* public-safe fields only (no private bucket keys)
* cached (ETag or `Cache-Control`)

This enables games to fetch the background list/config at runtime.

---

# Part 3 — Level Config Integration (Background Picker)

## 4) Add background selection to Level Config admin UI

If a Level Config editor already exists:

* Add a field `backgroundAssetId` (and optionally `backgroundVersionId`)
* UI: dropdown/search picker that uses `/api/catalog/backgrounds`

If Level Config editor does NOT exist yet:

* Implement a minimal Level Config admin area just enough for this phase:

  * `apps/admin/app/games/[gameId]/levels/[levelId]/page.tsx` (or similar)
  * Store a minimal `LevelConfig` record in Dynamo that includes:

    * `gameId`, `levelId`
    * `backgroundAssetId`
    * `backgroundVersionId` (optional; recommended to point to published version at time of selection)
* Include a “Save” button.

### Best practice choice: pin version or follow latest?

Implement BOTH modes (simple):

* Default: **follow latest published background** by storing only `backgroundAssetId`
* Optional toggle “Pin to version”:

  * store `backgroundVersionId`

This mirrors how studios handle art changes safely.

---

# Part 4 — Usage Tracking (“Used by X levels”)

## 5) Implement usage tracking model

Add an `AssetUsage` table/entity in Dynamo (or item type in single-table design):

Fields:

* `assetId`
* `usageType`: `level-background` | `game-splash` | `game-logo` | etc.
* `refId`: e.g. `GAME#{gameId}#LEVEL#{levelId}`
* `createdAt`

Update Level Config save logic so that when a background is set:

* Upsert usage record for that level referencing the asset
* If background changed, remove the previous usage record

Provide helper functions:

* `countAssetUsage(assetId): number`
* `listAssetUsage(assetId): Usage[]`

---

## 6) Show usage indicator in admin UI

On:

* Asset list view
* Asset detail page

Show:

* “Used by X levels”
* If clicked, show breakdown list (gameId/levelId) (optional; nice but not required)

---

# Part 5 — Safety: Prevent destructive actions for assets in use

## 7) Prevent deleting published assets in use

If you have delete endpoints for assets/versions:

* Disallow deleting:

  * Any `currentPublishedVersionId`
  * Any published version referenced by any usage record (if pinning is supported)
  * Any asset with usage count > 0

Instead:

* Provide “Archive” only
* For assets in use, “Archive” is disabled or warns “remove from levels first”

If you do not have delete endpoints yet:

* Add safety checks now anyway for future-proofing.

---

# Part 6 — Validation on Publish (Breaking Live Levels Prevention)

## 8) Publish validation hooks

When publishing a background asset version:

* Validate:

  * file exists in draft bucket
  * content-type is allowed
  * dimensions within bounds
* If asset is currently used by levels and the background is pinned by version:

  * publishing a new version does not affect those pinned usages
* If usage follows latest:

  * publishing will immediately affect runtime; that’s OK but must be intentional
  * require a “change notes” field (already likely exists)

---

# Part 7 — Ensure rollback fixes regressions instantly

## 9) Make rollback update effect immediate

Rollback already repoints `currentPublishedVersionId`. Ensure:

* Public Content API resolves URL based on currentPublishedVersionId
* CDN URL includes versionId so rollback switches URL, avoiding stale cache
* Add `revalidatePath` / cache invalidation for any cached homepage/config endpoints if you use Next caching.

---

# Acceptance Criteria (Exit Criteria)

✅ Published backgrounds selectable in level config without redeploy
✅ Runtime can fetch backgrounds catalog/config via `apps/web` API
✅ Asset list/detail shows “used by X levels”
✅ Cannot delete/unsafe-archive assets in use
✅ Publishing validates type and dimensions
✅ Rollback repoints published version and fixes regressions instantly (URL changes due to versioned path)

---

# Explicit Non-Goals (Do NOT implement)

❌ Full visual level editor
❌ Sprite sheet slicing / hitboxes
❌ Advanced dependency graphs
❌ Automated CDN invalidations (versioned URLs are enough)

---

# Expected File/Area Changes

**apps/admin**

* `app/editor/images/*` UI updates for usage indicators
* `app/api/catalog/backgrounds/route.ts`
* Level config editor background picker changes
* Dynamo usage repository `lib/assetUsage.ts`

**apps/web**

* `app/api/catalog/backgrounds/route.ts`
* Ensure any config/level endpoints can reference background assets

**shared**

* `packages/types` may need:

  * `BackgroundCatalogItem`
  * `AssetUsage` types

---

# Implementation Notes (important)

* Keep it minimal but correct.
* If Level Config is not yet fully implemented, create the smallest viable config model that demonstrates:

  * selecting a background
  * saving it
  * usage counting works
* Prefer “follow latest published” as default to reduce data churn, but allow “pin version” as a future-safe option.

---

Implement Phase 5 cleanly and aligned with existing repo conventions.
