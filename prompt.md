## Realtime Leaderboards + Sessions + Score Submission + WS Updates + Dynamo Snapshots

**Task:** Implement Step 5: the realtime scoring pipeline and leaderboards.

Create a working end-to-end flow where:

* a player opens a game page in `apps/web`
* the page connects to `apps/realtime` via WebSocket
* server issues a **single-use session token** for a run
* the client submits a score to `apps/web`
* `apps/web` validates the run and forwards it to `apps/realtime`
* `apps/realtime` updates **in-memory** leaderboards and broadcasts updates
* `apps/realtime` persists snapshots to DynamoDB and restores them on startup

This step should work with placeholder games (no actual game engine required yet).

---

# Context

* Nx monorepo
* Apps:

  * `apps/web` (Next.js App Router)
  * `apps/admin` (announcements CRUD)
  * `apps/realtime` (Node service; currently minimal)
* Auth is implemented in `apps/web` (Step 3). Users sign in with Google. Session provides:

  * `session.user.id` (Google sub)
  * `session.user.email`
* Games are defined in a code registry from Step 2.
* Styling is done already. Now we are building realtime backend + API integration.

**Constraints**

* No SQL DB
* Use DynamoDB for persistence
* In-memory leaderboards on realtime server
* WebSockets for pushing updates to clients

---

# Part A — Define shared contracts (types)

Create/update in `packages/types`:

## 1) WebSocket event types

Add:

* `packages/types/src/realtime.ts`

Export types:

```ts
export type LeaderboardScope = 'global' | 'local' | 'personal';

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  countryCode?: string;
  score: number;
  achievedAt: string;
};

export type LeaderboardState = {
  gameId: string;
  scope: LeaderboardScope;
  countryCode?: string;
  entries: LeaderboardEntry[];
  updatedAt: string;
};

export type WsClientMessage =
  | { type: 'subscribe'; gameId: string; scopes: Array<'global' | 'local' | 'personal'>; countryCode?: string; userId?: string }
  | { type: 'unsubscribe'; gameId: string }
  | { type: 'ping' };

export type WsServerMessage =
  | { type: 'ready' }
  | { type: 'leaderboard:state'; payload: LeaderboardState }
  | { type: 'leaderboard:update'; payload: LeaderboardState }
  | { type: 'error'; message: string };
```

Re-export from `packages/types/index.ts`.

---

# Part B — Realtime service (apps/realtime)

## 2) Add WebSocket server

Use a lightweight WS lib (prefer `ws`).

Install at workspace root:

* `ws`
* `@types/ws` (if TS needs it)

Create a WS server in `apps/realtime`:

* Listen on port from env: `REALTIME_PORT` default `4000`
* Provide a basic health endpoint (HTTP GET `/health`) returning 200 OK for deployment sanity

**File structure (create if helpful):**

```
apps/realtime/src/
  main.ts (or index.ts)
  server.ts
  leaderboards/
    store.ts
    snapshot.ts
    restore.ts
  ddb.ts
  types.ts (optional local helpers)
```

## 3) In-memory leaderboard store

Implement an in-memory store that maintains top N lists:

* `TOP_N = 50` (configurable)
* Structures:

  * `globalTop[gameId] -> LeaderboardEntry[]`
  * `localTop[gameId][countryCode] -> LeaderboardEntry[]`
  * `personalBest[gameId][userId] -> LeaderboardEntry` (store best score only)

Provide functions:

* `applyScore({ gameId, userId, displayName, countryCode, score, achievedAt })`

  * update personal best only if score greater
  * update global top N
  * update local top N for countryCode if present
* `getState(gameId, scope, countryCode?, userId?) -> LeaderboardState`

Ranking:

* Higher score wins
* Tie-breaker: earlier achievedAt wins (or latest; choose one and be consistent)

## 4) WebSocket subscription model

Clients will subscribe per gameId and scopes.

When a client sends:

```json
{ "type": "subscribe", "gameId": "...", "scopes": ["global","local","personal"], "countryCode":"GB", "userId":"..." }
```

Server should:

* store subscription (per ws connection)
* immediately send `leaderboard:state` for requested scopes
* on updates, broadcast only relevant payloads to subscribed clients

Include `ping/pong` keepalive.

## 5) DynamoDB persistence (snapshots)

Add DynamoDB client (AWS SDK v3) in realtime app.

Env vars:

* `AWS_REGION`
* `AWS_ACCESS_KEY_ID`
* `AWS_SECRET_ACCESS_KEY`
* optional `DDB_ENDPOINT`
* `DDB_TABLE_LEADERBOARD_SNAPSHOTS`
* optional `DDB_TABLE_SCORES` (if implementing score history)

Snapshot table model (simple):

* PK: `GAME#<gameId>#SCOPE#GLOBAL` or `GAME#<gameId>#SCOPE#COUNTRY#GB`
* SK: `SNAPSHOT`
* Attributes: `entries` (top N), `updatedAt`

Implement:

* restore on startup:

  * for each game in registry OR via scanning snapshot table (MVP okay)
  * load snapshots into memory
* periodic flush:

  * every 10 seconds flush changed leaderboards (throttle writes)
  * flush global and local states that changed
* do not persist personalBest snapshot for MVP unless easy; it can be derived from Scores later

**Important:** make persistence optional. If env vars not set, run in memory only.

## 6) Receive score updates from web

Realtime service must accept a server-to-server call from `apps/web` to apply scores.

Implement an HTTP endpoint in realtime app:

* `POST /score`
* Body:

```ts
{
  gameId: string;
  userId: string;
  displayName: string;
  countryCode?: string;
  score: number;
  achievedAt: string;
}
```

This endpoint:

* validates input
* calls `applyScore`
* broadcasts updated leaderboard states for:

  * global + local + personal (personal update only to that user’s subscriptions)
* returns 200

Secure it with a shared secret:

* env: `REALTIME_INGEST_SECRET`
* web includes header: `x-realtime-secret`

If secret missing in dev, allow localhost only (but prefer secret even in dev).

---

# Part C — Web app changes (apps/web)

## 7) Add Game Sessions API (single-use run tokens)

Implement:

* `POST /api/game-sessions`
* Auth required

It creates a short-lived session token:

* `token` = random UUID or crypto random string
* store in an in-memory map in `apps/web` server runtime:

  * `{ token -> { userId, gameId, expiresAt, consumed:false } }`
* TTL: 10 minutes
* “single use”: token is consumed when a score is submitted successfully

Note: This is MVP. We’ll move sessions to Dynamo later if needed.

Response:

```json
{ "token": "...", "expiresAt": "..." }
```

## 8) Add Score Submission API

Implement:

* `POST /api/scores/submit`
* Auth required

Body:

```ts
{
  gameId: string;
  score: number;
  runId: string; // client-generated uuid
  sessionToken: string;
  durationMs?: number;
}
```

Validation:

* session token exists, matches user + game, not expired, not consumed
* rate limit basic (per user, naive in-memory is fine for MVP)
* score sanity:

  * must be integer >= 0
  * apply per-game max if available in registry config (add optional `maxScore` to registry)

On success:

* mark token consumed
* forward score to realtime service:

  * `POST ${REALTIME_HTTP_URL}/score`
  * header `x-realtime-secret`
* return `{ ok: true }`

If realtime is down:

* return `{ ok: false, error: 'realtime_unavailable' }`

Env vars for web:

* `REALTIME_HTTP_URL=http://localhost:4000`
* `REALTIME_WS_URL=ws://localhost:4000`
* `REALTIME_INGEST_SECRET=...`

## 9) WebSocket client integration on game page

In the `/games/[slug]` page (Step 2):

* Update `LeaderboardPanel` to connect to `REALTIME_WS_URL` and subscribe.

Client behavior:

* On mount:

  * open WS connection
  * send `{type:'subscribe', gameId, scopes:['global','local','personal'], countryCode:'GB' (placeholder), userId if signed in}`
* Maintain local state for:

  * global entries
  * local entries
  * personal (best) entry
* Render table rows from WS state
* Show “Live” indicator when connected

For now, local countryCode can be:

* `'GB'` hardcoded OR derived from a simple env `DEFAULT_COUNTRY_CODE=GB`
  (we’ll do IP-based later)

## 10) Add a “Submit test score” button for MVP testing

Since games aren’t wired yet, add a dev-only button on the game page:

* visible when `process.env.NODE_ENV !== 'production'`
* button: “Submit test score”
* on click:

  * call `/api/game-sessions` to get token
  * submit a random score to `/api/scores/submit`
  * observe leaderboard update via WS

This allows testing end-to-end without building game logic yet.

---

# Part D — Nx targets / run instructions

Ensure these commands work:

* `nx dev web` (public site)
* `nx dev admin` (admin app)
* `nx serve realtime` (realtime WS + HTTP)

If `realtime` uses a node executor:

* ensure build output works: `nx build realtime` and `node dist/apps/realtime/...`

---

# Acceptance Criteria

1. Start services:

* web at `http://localhost:3000`
* realtime at `http://localhost:4000` (WS + `/health`)

2. Visit a game detail page `/games/<slug>`
3. Leaderboard panel shows connected state (or loading)
4. Click “Submit test score”
5. Leaderboard updates in real-time without refresh
6. Restart realtime service:

* it restores snapshots from Dynamo if configured
* otherwise starts empty

7. No SQL anywhere; only Dynamo optional

---

# Deliverables (files likely added/modified)

**packages/types**

* `src/realtime.ts`
* `index.ts` exports

**apps/realtime**

* `src/server.ts` (HTTP + WS)
* `src/leaderboards/store.ts`
* `src/leaderboards/restore.ts`
* `src/leaderboards/snapshot.ts`
* `src/ddb.ts`
* `src/main.ts` updates
* env example update (if you keep one)

**apps/web**

* `app/api/game-sessions/route.ts`
* `app/api/scores/submit/route.ts`
* `components/LeaderboardPanel/LeaderboardPanel.tsx` updated to use WS
* game detail page updated to include dev test submit button
* `.env.example` updated with realtime vars

