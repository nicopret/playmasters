# Playmasters Roadmap — Game & LiveOps Platform (Phase 2)

## Guiding Principles

Before the steps, these principles drive the roadmap order:

1. **Playable value early**
   Space Blaster must steadily move toward “fun + complete”, not stall behind tooling.

2. **Tooling grows just-in-time**
   Admin features are built *when the game needs them*, not all at once.

3. **Safety first**
   Versioning, staging, validation, and rollback come *before* powerful editors.

4. **Data-driven, not hardcoded**
   Anything designers may tweak later should move out of game code early.

---

## Phase 0 — Background / Image Editor (3 weeks)

**Goal:** Full control of level environments.

### Admin features

* Background upload
* Crop/resize
* Parallax layer definitions
* Background preview at multiple aspect ratios
* Background catalog + versioning

### Platform work

* Background schema
* Runtime background loader
* Optional parallax engine in Space Blaster

### Gameplay impact

* Levels visually distinct
* Difficulty can be communicated visually

✅ **Exit criteria**

* Background changes don’t require code deploy
* Assets are CDN-optimized
* Visual regression is recoverable via rollback

---

## Phase 1 — Baseline Hardening (1–2 weeks)

**Goal:** Stabilize what already exists so future work builds on solid ground.

### Deliverables

* Clean up Space Blaster skeleton:

  * deterministic enemy grid movement
  * consistent scoring
  * stable game-over states
* Lock in **Game SDK contract**

  * `startRun()`
  * `submitScore()`
* Finalize `/api/game-sessions` and `/api/scores/submit`
* Ensure realtime leaderboard reliability:

  * reconnect logic
  * snapshot restore verified
* Add basic telemetry hooks (events only, no dashboards yet)

### Why this comes first

* Prevents rewriting later
* Ensures admin-driven config won’t fight unstable runtime logic

✅ **Exit criteria**

* Space Blaster playable end-to-end
* Scores reliably hit leaderboards
* No hardcoded gameplay constants left without clear TODOs

---

## Phase 2 — Game Metadata & Versioning (Admin MVP) (2–3 weeks)

**Goal:** Admin can safely manage *what* a game is, without touching gameplay yet.

### Admin features

* Game list (read/write)
* Game metadata editor:

  * description
  * tagline
  * logo
  * splash screen
* Game-level notifications:

  * message
  * severity
  * start/end time
* Game versioning:

  * Draft / Staged / Published
  * One-click rollback
* Asset upload (logos, splash screens)

  * private → published promotion

### Platform work

* DynamoDB schema for:

  * Game
  * GameVersion
* S3/CDN setup for images
* Content API:

  * `GET /api/games/{gameId}/config`
* Public site consumes game metadata from API (SSR)

### Why now

* Enables non-code iteration
* Validates versioning + publish flow before complexity increases

✅ **Exit criteria**

* Game metadata can be changed without redeploy
* Rollback works in under 1 minute
* Public site reflects published version only

---

## Phase 3 — Level System (Data-Driven Gameplay) (3–4 weeks)

**Goal:** Move Space Blaster gameplay parameters out of code and into admin-managed config.

### Admin features

* Level list per game
* Level ordering
* Level versioning (Draft / Staged / Published)
* Level config editor (form-based, no visuals yet):

  * background selection
  * enemy spawn positions (JSON input)
  * difficulty multipliers
  * music selection
  * score rules

### Platform work

* Level + LevelVersion Dynamo schema
* Level config JSON schema + validation
* Content API:

  * `GET /api/games/{gameId}/levels/{levelId}`
* Space Blaster loads level config at runtime
* Difficulty curve now data-driven

### Gameplay impact

* Space Blaster now supports:

  * multiple levels
  * increasing difficulty
  * no hardcoded spawn logic

✅ **Exit criteria**

* Levels can be added/edited without redeploy
* Broken configs are rejected before publish
* Game behaves identically across reloads

---

## Phase 4 — Catalogs (Enemies, Ammo, Heroes, Obstacles) (3 weeks)

**Goal:** Prevent chaos by introducing controlled, reusable gameplay building blocks.

### Admin features

* Enemy catalog:

  * sprite
  * base score
  * base health
* Ammo catalog:

  * damage
  * speed
* Hero catalog:

  * sprite
  * movement speed
* Obstacle catalog:

  * hitbox
  * durability

Levels reference **catalog IDs**, not raw values.

### Platform work

* Catalog Dynamo tables
* Schema validation
* Content API:

  * `/api/catalog/enemies`
  * `/api/catalog/ammo`
  * etc.
* Space Blaster resolves catalogs at runtime

### Why this matters

* Designers can’t “break” the game accidentally
* Balance changes are centralized
* Enables reuse across future games

✅ **Exit criteria**

* Levels only reference catalog entries
* Score/damage tuning requires no code changes
* One enemy tweak affects all levels safely

---

## Phase 5 — Sprite Editor (MVP) (3–4 weeks)

**Goal:** Bring visual iteration in-house.

### Admin features

* Sprite upload (PNG/WebP/SVG)
* Sprite metadata editor:

  * size
  * hitbox
  * type (enemy/hero/ammo)
* Sprite preview
* Sprite versioning
* Assign sprite to catalog entries

### Platform work

* Sprite + SpriteVersion schema
* Private → public asset promotion
* CDN cache-busting
* Runtime sprite loading

### What this unlocks

* Designers don’t need devs for asset tweaks
* Visual iteration speed increases dramatically

✅ **Exit criteria**

* Sprite changes reflect in-game without redeploy
* Rollback of broken sprites works
* No raw asset URLs in level configs

---

## Phase 6 — Advanced Level Authoring Tools (Optional, later)

**Goal:** Move from forms → visual tools.

### Features

* Canvas-based level editor
* Drag-and-drop enemy spawns
* Obstacle placement
* Hitbox overlays
* Real-time preview in admin

This phase is **not required** to launch, but is a major productivity multiplier.

---

## Phase 7 — LiveOps & Analytics (Ongoing)

**Goal:** Close the feedback loop.

### Features

* Level completion metrics
* Difficulty heatmaps
* Score distribution
* Drop-off analysis
* A/B testing for difficulty

This informs:

* balance changes
* future monetization
* event design

---

## High-Level Timeline (Rough)

| Phase    | Duration | Cumulative |
| -------- | -------- | ---------- |
| Phase 0  | 1–2 wks  | 2 wks      |
| Phase 1  | 2–3 wks  | 5 wks      |
| Phase 2  | 3–4 wks  | 9 wks      |
| Phase 3  | 3 wks    | 12 wks     |
| Phase 4  | 3–4 wks  | 16 wks     |
| Phase 5  | 3 wks    | 19 wks     |
| Phase 6+ | optional | —          |

---

## Strategic Outcome

By the end of **Phase 3**, you already have:

* A fully playable Space Blaster
* Admin-controlled gameplay
* Safe publishing & rollback
* A reusable platform for future games

By **Phase 5**, Playmasters becomes:

> a real **game platform**, not just a site with games.

---

## Recommended Next Step (Very Important)

Before coding:

1. Lock **Level JSON schema v1**
2. Lock **Catalog schemas**
3. Decide **what Space Blaster v1 absolutely needs**, and push everything else to v1.1

If you want, next I can:

* Convert this roadmap into **Jira epics + stories**
* Create a **Codex prompt for Phase 1**
* Or define **Space Blaster Level Config v1 (JSON schema)** so implementation starts cleanly
