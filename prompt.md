## 🔹 Game SDK + First Phaser Game + Score Hooks + Platform Integration

**Task:** Implement Step 7: create a reusable **Game SDK** and ship the first real **Phaser 3** game integrated into the Playmasters platform with real scoring, session handling, and realtime leaderboards.

This step replaces the “Submit test score” button with real in-game score submission using a shared SDK and a consistent embed pattern.

---

# Context

* Nx monorepo
* Existing apps:

  * `apps/web` (public Next.js) — game pages, session issuance, score submit endpoint
  * `apps/realtime` — websocket leaderboard authority
  * `apps/admin` — announcements
* Existing packages:

  * `@playmasters/brand`, `@playmasters/ui`, `@playmasters/types`
* Realtime pipeline exists (Step 5):

  * `/api/game-sessions` + `/api/scores/submit` in web
  * realtime receives score updates and broadcasts leaderboards over WS
* Games list is code-defined (registry) and includes some “available” games.
* CSS Modules + design tokens.

Goal: add a real game and a real client-side integration contract so new games can be added quickly and safely.

---

# Part A — Add Phaser and create first game package

## 1) Add dependencies

Install at workspace root:

* `phaser`

No other game engine dependencies.

---

## 2) Create first game package

Create an Nx lib under `packages/games`:

* `packages/games/space-blaster` (or pick a slug that already exists as `available` in your registry)

Use Nx generator if available, otherwise create manually.

Export from `packages/games/space-blaster/src/index.ts` a function or class that can be mounted in a DOM element.

---

# Part B — Define the Game SDK (`@playmasters/game-sdk`)

## 3) Create/implement Game SDK types and APIs

In `packages/game-sdk/src/`, implement:

### 3.1) Core types

Create `types.ts`:

```ts
export type GameContext = {
  gameId: string;
  user?: {
    id: string;
    displayName: string;
  };
  countryCode?: string;
  realtimeWsUrl: string;
  apiBaseUrl?: string; // default ''
};

export type GameRun = {
  runId: string;
  startedAt: string;
};

export type ScoreSubmission = {
  gameId: string;
  sessionToken: string;
  runId: string;
  score: number;
  durationMs?: number;
};

export type GameSdk = {
  startRun(): Promise<{ run: GameRun; sessionToken: string }>;
  submitScore(payload: Omit<ScoreSubmission, 'sessionToken' | 'runId' | 'gameId'> & { score: number; durationMs?: number }): Promise<void>;
};
```

### 3.2) SDK implementation

Create `sdk.ts` exporting:

```ts
export function createGameSdk(ctx: GameContext): GameSdk
```

Behavior:

* `startRun()`:

  * `POST /api/game-sessions` (relative to ctx.apiBaseUrl)
  * generate `runId` (crypto.randomUUID)
  * store `sessionToken` + `runId` in closure
  * return both
* `submitScore({score, durationMs})`:

  * `POST /api/scores/submit` with:

    * gameId
    * score
    * runId
    * sessionToken
    * durationMs
  * throw on non-200

Ensure:

* SDK is browser-safe
* Uses `fetch`
* Has minimal error handling (surface errors to caller)
* Does NOT import any Node-only modules.

Export from `packages/game-sdk/src/index.ts`.

---

# Part C — Define the “Game Contract” for all games

## 4) Standard game interface

In `packages/types` add `game.ts`:

```ts
export type EmbeddedGame = {
  mount: (opts: {
    el: HTMLElement;
    sdk: import('@playmasters/game-sdk').GameSdk;
    onReady?: () => void;
    onGameOver?: (finalScore: number) => void;
  }) => { destroy: () => void };
};
```

(Or keep this type in `game-sdk`, whichever is cleaner — but it must be shared.)

All games must export an object implementing this contract.

---

# Part D — Implement the first Phaser game (Space Blaster)

## 5) Game design (simple arcade loop, real scoring)

Implement a simple but complete game:

* 800x450 canvas (scales responsively)
* Player ship moves left/right
* Auto-shoot or press space to shoot
* Enemies spawn and move downward
* When a bullet hits an enemy:

  * score += 10
* If enemy collides with player or reaches bottom:

  * game over
* On game over:

  * call `sdk.submitScore({ score, durationMs })`

The game must:

* call `sdk.startRun()` when starting gameplay (beginning of run)
* track start time
* submit on game over once
* show “Submitting…” state and then “Submitted” or “Error”
* include a “Play again” button

No assets required; use Phaser graphics primitives (rectangles/circles) so it is self-contained.

---

# Part E — Integrate game into `apps/web` game page

## 6) Add a Game Host component in the web app

Create a client component:

```
apps/web/components/GameHost/GameHost.tsx
apps/web/components/GameHost/GameHost.module.css
```

Props:

* `gameId` (slug)
* `gameTitle`
* `realtimeWsUrl` (from env)
* `apiBaseUrl` (usually '')
* `user` (from session; optional)

Behavior:

* Creates SDK via `createGameSdk`
* Looks up the game module based on gameId:

  * import from `@playmasters/<game-package>` or a local mapping
* Mounts the game into a div ref
* Handles cleanup on unmount
* Shows a thin HUD:

  * connection/auth status
  * small instructions
  * errors

---

## 7) Update `/games/[slug]` page to embed real game when available

* If game status is `available` and a matching game package exists:

  * render `<GameHost ... />` in place of placeholder box
* If `coming-soon`, keep placeholder

Remove (or keep only in dev) the old “Submit test score” button from Step 5.

---

## 8) Ensure leaderboards update live

When the score is submitted:

* `apps/web` forwards to realtime
* realtime updates state
* `LeaderboardPanel` already connected via WS should update automatically

Add a small UX improvement:

* after submitting score, `GameHost` can request updated leaderboard state by sending WS subscribe again or rely on broadcast.

---

# Part F — Registry updates

## 9) Update games registry

Mark the first Phaser game as:

* `status: 'available'`
* Ensure slug matches the package name and route

Add optional config in registry:

* `maxScore` (optional) for future validation
* `description` and tags

---

# Part G — Developer experience & checks

## 10) Add basic tests / lint

No heavy testing required, but:

* Typecheck passes
* `nx build` for web and game package passes
* Ensure Phaser imports are client-only (GameHost is client component)
* Avoid importing Phaser in server components

---

# Acceptance Criteria

1. Run:

* `nx dev web`
* `nx serve realtime`

2. Visit `/games/<space-blaster-slug>`

* The Phaser game loads and is playable
* On game over, score is submitted through SDK
* Leaderboard updates live in the leaderboard panel without refresh

3. Signed-out users:

* Can play
* But score submission requires auth:

  * If not signed in, show “Sign in to submit score”
  * Do not call `/api/game-sessions` unless authenticated

4. No hardcoded colors; use tokens for overlays and buttons.

---

# Deliverables

Expected new/updated files include:

**packages/game-sdk**

* `src/types.ts`
* `src/sdk.ts`
* `src/index.ts`

**packages/types**

* `src/game.ts` (if used)
* `index.ts` export

**packages/games/space-blaster**

* `src/index.ts`
* `src/game.ts` (Phaser implementation)

**apps/web**

* `components/GameHost/GameHost.tsx`
* `components/GameHost/GameHost.module.css`
* `/games/[slug]` page updated to render GameHost when available
* registry updated to include/enable the game

