## Updated Architecture Document (Nx monorepo + CSS Modules + DynamoDB + in-memory + WebSockets)

### 1) Goals

Playmasters is a retro arcade platform where:

* The **landing page** is server-side rendered and contains:

  1. A top **carousel** for news/announcements (**max 5**)
  2. Site explanation (aims + how it works)
  3. A **games grid** (games are code-defined and deployed)
  4. Social links + footer
* Each **game page** hosts the game and shows:

  * **Global leaderboard**
  * **Local leaderboard** (country/region)
  * **Personal best** per user
* Users authenticate via **Google OAuth**, which is also used to persist scores.
* Games are authored once and shipped to **Web + Desktop + Mobile** (wrappers around the web build).

---

## 2) Architecture overview

### Key decisions

* **Nx monorepo**
* **Next.js** for website + APIs
* **CSS Modules + Design Tokens** for styling (no Tailwind)
* **No SQL DB**

  * Games & static content (mostly) via code deployments
  * Scores and snapshots in **DynamoDB**
  * **In-memory leaderboards** in a running server
  * **WebSockets** for realtime leaderboard updates
* **Google auth** via Auth.js / NextAuth

### High-level components

1. **Web App (Next.js)**

   * SSR landing page
   * Game pages
   * API endpoints (session issuance, score submission, leaderboard reads)
2. **Realtime Service (WebSocket server)**

   * Maintains hot leaderboard state in memory
   * Broadcasts leaderboard changes
   * Persists periodically to DynamoDB
   * Restores leaderboards from DynamoDB on startup
3. **DynamoDB**

   * Durable storage for:

     * Score records (optional full history)
     * Leaderboard snapshots (top N per scope)
     * Announcements (recommended for SSR + persistence)
4. **Wrappers**

   * **Mobile** via Capacitor
   * **Desktop** via Tauri (or Electron)

> For MVP you *can* run WebSockets inside the Next.js node runtime, but the clean long-term approach is a separate “realtime” app in Nx so it can scale and deploy independently.

---

## 3) Repo strategy (Nx monorepo)

### Proposed Nx workspace layout

```
playmasters/
  apps/
    web/                  # Next.js (SSR pages + API routes)
    realtime/             # Node WS server (authoritative leaderboard state)
    mobile/               # Capacitor wrapper config
    desktop/              # Tauri wrapper config

  packages/
    brand/                # design tokens, fonts, logo assets, base CSS
    ui/                   # reusable UI components (CSS Modules)
    games/
      <game-slug-1>/      # Phaser game package
      <game-slug-2>/
    types/                # shared TS types for events and payloads
    utils/                # shared utilities
```

### Styling strategy

* `packages/brand` exports:

  * `tokens.css` (CSS variables for palette, radii, spacing, shadows)
  * `fonts.css`
  * shared constants
* `packages/ui` exports components using **CSS Modules** and the tokens.
* `apps/web` imports tokens once in root layout.

This keeps Playmasters’ look consistent across web + wrappers.

---

## 4) Runtime details

### 4.1 Landing page

* Announcements carousel shows **up to 5** items.
* Preferred source of truth:

  * **DynamoDB Announcements table** (SSR can fetch and render)
  * WebSockets can push live changes to connected clients
* Games grid:

  * **Code-defined registry** (build-time import)
  * Adds/removals via deployment

### 4.2 Game pages

Route: `/games/[slug]`

* Server renders:

  * Game metadata (title, description)
  * Placeholder/loading shell
* Client loads:

  * game bundle (from `packages/games/<slug>`)
  * connects to WS for live leaderboard
  * requests a session token for score submission

---

## 5) Authentication & identity

* Google login via Auth.js / NextAuth
* Use Google `sub` as stable user identifier.
* Store minimal user profile:

  * Either in DynamoDB (optional) or derived from token on demand.
* Local leaderboards require **country/region**:

  * Determine at login using IP geolocation and store as a claim (or store per user in Dynamo)
  * Also denormalize `country_code` into score records at submission time

---

## 6) Data model (DynamoDB)

### Table A: `Scores` (optional full history, recommended)

Purpose: auditability, moderation, analytics later.

**Primary Key**

* PK: `GAME#<gameId>`
* SK: `SCORE#<scoreValue>#TS#<isoTimestamp>#RUN#<runId>`

Attributes:

* userId
* scoreValue
* achievedAt
* countryCode
* runMeta (duration, mode, difficulty, clientVersion)
* isValid (bool)

**GSI: Personal Best Query**

* GSI1PK: `USER#<userId>#GAME#<gameId>`
* GSI1SK: `SCORE#<scoreValue>#TS#<isoTimestamp>`

> If you don’t want full history at MVP, you can skip this and store only personal best + snapshots, but keeping `Scores` pays off quickly for cheat review.

---

### Table B: `LeaderboardSnapshots`

Purpose: fast restore on boot + SSR reads without hitting the hot server.

**Primary Key**

* PK: `GAME#<gameId>#SCOPE#GLOBAL`
* SK: `SNAPSHOT`

For local:

* PK: `GAME#<gameId>#SCOPE#COUNTRY#<code>`
* SK: `SNAPSHOT`

For personal bests (optional snapshot form):

* PK: `GAME#<gameId>#SCOPE#PERSONAL`
* SK: `USER#<userId>`

Attributes:

* topScores (array of top N entries)
* updatedAt
* version

---

### Table C: `Announcements`

Purpose: SSR-friendly announcements with persistence.

**Primary Key**

* PK: `ANNOUNCEMENTS`
* SK: `PUBLISHED#<publishedAt>#<id>`

Attributes:

* title, body
* imageUrl (optional)
* ctaLabel, ctaHref (optional)
* isActive (bool)
* sortOrder (int)

Enforce max 5 active in admin logic:

* on publish/activate, deactivate extras by sortOrder or oldest-first.

---

## 7) Realtime layer (WebSockets + in-memory)

### Responsibilities

* Maintain in-memory leaderboard structures:

  * `globalTopN[gameId]`
  * `localTopN[gameId][country]`
  * `personalBest[gameId][userId]`
* Publish events to clients:

  * `leaderboard:update`
  * `announcement:update`
* Persist snapshots to DynamoDB:

  * on schedule (e.g., every 10–30 seconds) and/or on change with throttling
* Restore from DynamoDB at startup:

  * load snapshots into memory

### Important scaling constraint (explicit)

**MVP assumption:** single realtime instance (or sticky sessions).
If you later need multiple instances:

* Add Redis pub/sub or DynamoDB Streams-based fanout
* Or route all score writes through one “leaderboard authority” service

---

## 8) Score submission & integrity

### Recommended flow

1. `POST /api/game-sessions` (web app)

   * server returns session token: `{ token, expiresAt, nonce }`
2. Game ends → `POST /api/scores/submit`

   * includes token, gameId, scoreValue, runMeta, runId
3. Server validates:

   * token valid, not expired, not reused
   * rate limiting per user/IP
   * game-defined plausibility checks (max score, min duration)
4. Server updates realtime service (direct call or message):

   * realtime updates in-memory
   * broadcasts via WS
   * persists snapshot and/or appends to Scores table

---

## 9) Deployment model

* `apps/web` deployed on a Node-capable host (Vercel is OK if WS constraints are handled; otherwise use AWS ECS/Fargate/Fly/Render).
* `apps/realtime` deployed as a long-running Node process (needs stable WebSocket support).
* DynamoDB in AWS.
* Mobile/desktop wrappers pull from web build output.

> If you want simplest ops: deploy both web + realtime to the same platform that supports long-running processes and WebSockets (e.g., Fly.io, Render, ECS). Then optionally move web to Vercel later.

---

# Updated Development Roadmap

## Phase 0 — Monorepo & Foundations (Week 1)

* Nx workspace setup
* Create `apps/web` (Next.js) + `apps/realtime` (Node WS)
* Create `packages/brand` (tokens.css, fonts.css, logo assets)
* Create `packages/ui` (Button, Card, GameTile skeleton)
* Auth.js Google integration in `apps/web`
* Define games registry in code (`packages/games-registry` or inside `apps/web`)

**Deliverable:** SSR site boots, styling tokens applied, login works, WS server running.

---

## Phase 1 — Landing Page & Announcements (Week 2)

* Landing page sections implemented:

  * Carousel (max 5)
  * About/how-it-works
  * Games grid from code registry
  * Social + footer
* DynamoDB `Announcements` table + fetch for SSR
* WebSocket event:

  * `announcement:update` to live-update connected clients
* Minimal admin mechanism (choose one):

  * protected admin page in web, or
  * simple signed endpoint + JSON editor

**Deliverable:** landing page complete, announcements persist and update live.

---

## Phase 2 — Game Shell + First Game + Sessions (Weeks 3–4)

* Implement `/games/[slug]` page:

  * loads game bundle
  * connects WS
  * shows leaderboards panel
* Implement `POST /api/game-sessions`
* Implement `POST /api/scores/submit`
* In `apps/realtime`:

  * in-memory structures for global/local/personal
  * broadcast leaderboard updates
* DynamoDB `LeaderboardSnapshots` (restore on boot + periodic flush)

**Deliverable:** one playable game with realtime global/local/personal leaderboards.

---

## Phase 3 — Platformizing Games (Weeks 5–6)

* Standardize game contract:

  * `init()`, `start()`, `pause()`, `onGameOver()`
* Add 2–3 more games using the template
* Add “personal best” display per game page

**Deliverable:** repeatable pipeline to add games quickly and safely.

---

## Phase 4 — Integrity, Rate Limits, Moderation (Weeks 7–8)

* Add rate limiting (per user/IP)
* Add game-specific validation config:

  * max score, max scoring rate, min duration
* Add `Scores` table (if not already) for audit/history
* Admin moderation tools:

  * view top runs
  * invalidate suspicious scores

**Deliverable:** robust score pipeline with basic anti-cheat and moderation.

---

## Phase 5 — Desktop & Mobile Wrappers (Weeks 9–10)

* Capacitor mobile wrapper (auth + WS)
* Tauri desktop wrapper
* Shared build pipeline in Nx
* Release artifacts via CI

**Deliverable:** Web + Desktop + Mobile distributions from one monorepo.

---

## Phase 6 — Scale-out Options (Future)

When you outgrow a single realtime instance:

* Add Redis pub/sub for WS fanout and shared state
* Or implement a “leaderboard authority” with message queue
* Partition by gameId (shards) for very high throughput

---
