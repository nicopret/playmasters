Below is a **detailed, execution-ready roadmap and project plan** for building the **Playmasters Image Editor** (pixel-level + OpenAI-assisted) based directly on the architecture document you approved.

This is written the way internal studio tools are planned: **phased, dependency-aware, risk-controlled**, and designed to deliver value early while keeping scope sane.

---

# Playmasters Image Editor

## Detailed Roadmap & Project Plan

---

## Executive Goal

Deliver a **standalone, admin-only Image Editor** that:

* Runs inside `apps/admin`
* Supports **pixel-level editing** suitable for retro arcade art
* Integrates **OpenAI image editing via text instructions**
* Manages assets with **draft → publish → rollback**
* Becomes the **foundation for backgrounds now and sprites later**

This tool is a **platform investment**, not just a feature.

---

## Guiding Constraints (locked)

* Admin-only (separate origin)
* HTML Canvas–based editor (pixel-accurate)
* OpenAI calls **server-side only**
* DynamoDB for metadata, S3 + CDN for binaries
* No commercial-grade expectations (Photoshop is out of scope)
* Must feel *fast, safe, predictable*

---

## Phase Breakdown Overview

| Phase | Name                                    | Duration  | Risk   |
| ----- | --------------------------------------- | --------- | ------ |
| 0     | Foundations & Guardrails                | 1 week    | Low    |
| 1     | Asset Library & Versioning              | 1.5 weeks | Low    |
| 2     | Pixel Canvas Editor (Core)              | 2–3 weeks | Medium |
| 3     | Selection, Masking & Undo               | 1.5 weeks | Medium |
| 4     | OpenAI Image Editing Integration        | 1–2 weeks | Medium |
| 5     | Publish, Rollback & Catalog Integration | 1 week    | Low    |
| 6     | UX Polish & Hardening                   | 1 week    | Low    |
| 7     | Sprite-Ready Enhancements (optional)    | later     | —      |

Total MVP: **~8–10 weeks**

---

## Phase 0 — Foundations & Guardrails (Week 1)

### Goal

Lay down **non-negotiable safety and structure** before UI work.

### Deliverables

* Admin navigation entry: **“Image Editor”**
* Routes scaffolded:

  * `/editor`
  * `/editor/images`
  * `/editor/images/new`
  * `/editor/images/:assetId`
* RBAC enforcement:

  * admin-only access
* Environment config:

  * S3 buckets (private drafts / public published)
  * DynamoDB table(s) for assets & versions
* API skeleton:

  * `/api/assets`
  * `/api/assets/:id`
  * `/api/assets/:id/versions`

### Technical Tasks

* Define DynamoDB schema:

  * ImageAsset
  * ImageAssetVersion
* Define S3 key conventions
* Implement upload API (no editor yet)
* Basic asset list UI (title, type, status)

### Risks Addressed

* Prevents asset sprawl
* Prevents unsafe key handling
* Locks lifecycle model early

✅ **Exit criteria**

* Admin can upload an image and see it listed as a Draft
* No editor yet, but lifecycle works

---

## Phase 1 — Asset Library & Versioning (Week 2–3)

### Goal

Make assets **manageable, auditable, and reversible**.

### Deliverables

* Asset list view:

  * filter by type (background, sprite, splash)
  * draft vs published indicator
* Asset detail page:

  * preview image
  * metadata (title, tags, dimensions)
  * version list
* Versioning:

  * create new draft from published
  * archive old versions
* Publish workflow:

  * promote Draft → Published
  * auto-CDN promotion
* Rollback:

  * repoint published version

### Technical Tasks

* Dynamo pointers:

  * `currentDraftVersionId`
  * `currentPublishedVersionId`
* CDN cache-busting via versioned URLs
* Audit logging (who, when, what)

### Risks Addressed

* Broken assets going live
* No rollback path
* No history of changes

✅ **Exit criteria**

* Assets can be published and rolled back without redeploy
* Public URLs stable and cache-safe

---

## Phase 2 — Pixel Canvas Editor (Core) (Week 3–5)

### Goal

Deliver a **true pixel-level editor** suitable for retro graphics.

### Deliverables

* Canvas editor UI:

  * nearest-neighbor scaling
  * zoom controls
  * pixel grid overlay
* Core tools:

  * pencil (1px + N px)
  * eraser
  * fill/bucket
  * color picker
* Color handling:

  * manual color selection
  * optional small palette strip
* Save edits as new Draft version

### Technical Tasks

* HTML Canvas + ImageData engine
* Tool abstraction (each tool mutates pixels)
* Viewport scaling separate from native resolution
* Undo stack (snapshot-based initially)

### Risks Addressed

* Blurry output (explicitly avoided)
* Non-deterministic edits
* Overengineering too early

✅ **Exit criteria**

* You can manually draw/edit a background at pixel level
* Exported image matches exact pixels edited

---

## Phase 3 — Selection, Masking & Undo (Week 5–6)

### Goal

Enable **controlled edits and AI compatibility**.

### Deliverables

* Rectangular selection tool
* Visual selection overlay
* Mask generation:

  * selected area → white
  * rest → transparent
* Undo/redo improvements:

  * snapshot throttling
  * clear history per version

### Technical Tasks

* Selection state management
* Mask canvas generation
* Export mask as PNG
* UX cues for “active selection”

### Risks Addressed

* AI edits affecting unintended areas
* Irreversible destructive edits

✅ **Exit criteria**

* Selection can be used for both manual edits and AI edits
* Undo is reliable and predictable

---

## Phase 4 — OpenAI Image Editing Integration (Week 6–7)

### Goal

Add **AI-assisted editing via natural language**, safely.

### Deliverables

* AI prompt panel:

  * text input
  * scope selector (whole image / selection)
  * style presets (Pixel Art / Minimal / Modern)
* Backend route:

  * `POST /api/image-edit`
* AI preview flow:

  * show result
  * accept → new draft
  * discard → no changes

### Technical Tasks

* Server-side OpenAI integration (Images API)
* Prompt templating for pixel-art safety
* Rate limiting & error handling
* Image validation post-AI

### Risks Addressed

* API key exposure
* AI destroying pixel art style
* User confusion over destructive changes

✅ **Exit criteria**

* AI edits work end-to-end
* Original image never overwritten
* All AI results are drafts only

---

## Phase 5 — Publish, Rollback & Catalog Integration (Week 7–8)

### Goal

Make edited images **usable everywhere** in the platform.

### Deliverables

* Asset type enforcement:

  * background
  * sprite (future)
  * splash
  * UI
* Background catalog integration:

  * published backgrounds selectable in level config
* Usage indicators:

  * “used by X levels”
* Safety:

  * prevent deleting published assets in use

### Technical Tasks

* Catalog read APIs
* Reference counting or soft usage tracking
* Validation on publish

### Risks Addressed

* Breaking live levels
* Orphaned assets

✅ **Exit criteria**

* Backgrounds edited here show up in games without redeploy
* Rollback fixes visual regressions instantly

---

## Phase 6 — UX Polish & Hardening (Week 8–9)

### Goal

Make the editor **pleasant and reliable**, not just functional.

### Deliverables

* Keyboard shortcuts (draw, undo, zoom)
* Loading/progress indicators
* Better error messages
* Autosave safety (optional)
* Performance tuning for larger images

### Technical Tasks

* Debounce saves
* Improve memory handling
* UX feedback loops

### Risks Addressed

* Frustrating daily use
* Editor abandonment by designers

✅ **Exit criteria**

* Editor feels stable enough for daily use
* No data loss in normal workflows

---

## Phase 7 — Sprite-Ready Enhancements (Later, Optional)

### Goal

Prepare for **sprite-specific workflows**.

Possible additions:

* Sprite-sheet slicing
* Hitbox overlay editor
* Animation frame preview
* Palette import/export (e.g., NES palettes)

This phase should only begin **after Space Blaster is content-complete**.

---

## Dependencies & Critical Path

Critical dependencies:

* S3 + Dynamo lifecycle → must be correct early
* Pixel editor correctness → cannot be “fixed later”
* AI integration depends on masking

Critical path:

```
Versioning → Canvas → Selection → AI → Publish
```

---

## Staffing Reality (Honest)

This roadmap assumes:

* 1 strong full-stack engineer
* Occasional design feedback
* No parallel feature explosions

Trying to parallelize early phases **increases risk**, not speed.

---

## Strategic Outcome

At completion of Phase 5:

You will have:

* A reusable internal image tool
* Faster iteration for every game
* Reduced dependency on external art tools
* A competitive LiveOps capability most indie platforms never reach

This is a **force multiplier**, not a side feature.

---

## Recommended Immediate Next Step

Before coding:

1. Lock **ImageAsset + ImageAssetVersion schema**
2. Decide **exact MVP tool list** (no creep)
3. Start Phase 0

If you want, next I can:

* Convert this into **Nx task milestones**
* Produce a **Codex prompt for Phase 0 + 1**
* Design the **canvas tool architecture in code** (how tools mutate ImageData)

Just tell me where you want to go next.
