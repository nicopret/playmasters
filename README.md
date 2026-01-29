Below is a **drop-in `README.md`** you can paste into the root of your GitHub repo. It includes:

* Project description
* An architectural diagram block
* Current monorepo structure
* How to run the components that exist right now (web, realtime, storybook, libs)

> I can’t create the GitHub repository for you directly from here, but this README is “repo-ready”.

---

````md
# 🎮 Playmasters

Playmasters is a modern retro arcade platform where players compete for high scores in browser-based games with real-time leaderboards.

The platform is designed for:
- ⚡ Server-rendered web experience (Next.js)
- 🌐 Real-time leaderboards (WebSockets + in-memory state)
- 🔐 Google authentication
- 🧠 Durable score/snapshot persistence with DynamoDB
- 🎨 Custom arcade design system (CSS Modules + design tokens)
- 📦 Nx monorepo for multi-app + shared packages

---

## Architecture

### High-level diagram

```mermaid
flowchart TB
  U[Players] -->|HTTP| WEB[apps/web\nNext.js SSR + API routes]
  U -->|WebSocket| RT[apps/realtime\nLeaderboard Authority]

  WEB -->|Create session / Submit score| RT
  RT -->|Broadcast updates| U

  RT -->|Read on boot| DDB[(DynamoDB)]
  RT -->|Persist snapshots / scores| DDB

  WEB -->|SSR fetch announcements (optional)| DDB
  WEB -->|Imports| UI[packages/ui]
  WEB -->|Imports| BRAND[packages/brand]
  WEB -->|Imports| SDK[packages/game-sdk]
  SDK --> TYPES[packages/types]
  RT --> TYPES
````

### Runtime model (today)

* **apps/web** serves the SSR landing page and game pages.
* **apps/realtime** runs a long-lived WebSocket service:

  * keeps leaderboards in memory
  * broadcasts leaderboard updates to connected clients
  * persists snapshots/scores to DynamoDB (when configured)
  * restores snapshots from DynamoDB on startup
* **packages/brand** provides global design tokens and fonts
* **packages/ui** provides reusable UI components (CSS Modules)
* **packages/game-sdk** is the client SDK for session + WS + score submission
* **packages/types** defines shared event payloads and API types

---

## Repository layout

```
apps/
  web/            # Next.js SSR site + API endpoints
  realtime/       # Node WebSocket service (leaderboard authority)

packages/
  brand/          # design tokens + fonts + brand exports
  ui/             # shared UI components (CSS Modules)
  game-sdk/       # client SDK for games (ws + sessions + score submit)
  types/          # shared TS contracts
  games/          # game packages (added over time)
```

---

## Prerequisites

* Node.js 20+
* pnpm
* (Optional for persistence) AWS credentials + DynamoDB tables

Install dependencies:

```bash
pnpm install
```

---

## Running the project (local dev)

### 1) Run the web app (Next.js)

```bash
nx dev web
```

The web app will start on the port configured by Next.js (commonly `http://localhost:3000`).

### 2) Run the realtime WebSocket service

```bash
nx serve realtime
```

The realtime service runs as a long-lived node process (port configured in `apps/realtime`).

> If you’re running both services locally, open two terminals:
>
> * Terminal A: `nx dev web`
> * Terminal B: `nx serve realtime`

---

## Storybook (UI previews)

Storybook is configured for the UI library.

```bash
nx storybook ui
```

Storybook runs at:

* `http://localhost:4400`

Build static Storybook output:

```bash
nx build-storybook ui
```

Output directory:

* `dist/storybook/ui`

---

## Building

### Build web

```bash
nx build web
```

### Build realtime

```bash
nx build realtime
```

### Desktop & Mobile (wrappers)

These wrappers reuse the hosted web UI; they don't bundle duplicate frontend code.

* Desktop (Tauri): `nx run desktop:dev` (loads `PLAYMASTERS_WEB_URL`, defaults to `http://localhost:3000`) and `nx run desktop:build` for installers.
* Mobile (Capacitor): `nx run mobile:sync` then `nx run mobile:ios` / `nx run mobile:android` to open Xcode/Android Studio. The WebView points at `PLAYMASTERS_WEB_URL`.

Required env hints (set in `.env` or shell):

```bash
PLAYMASTERS_WEB_URL=http://localhost:3000
REALTIME_WS_URL=ws://localhost:4000
```

---

## Linting & typechecking

```bash
nx lint web
nx lint realtime
nx lint ui
```

You can also run affected targets:

```bash
nx affected -t lint
nx affected -t build
```

---

## Environment variables

### Web (apps/web)

If Google auth is enabled, configure the usual Auth.js / NextAuth env vars:

* `GOOGLE_CLIENT_ID`
* `GOOGLE_CLIENT_SECRET`
* `NEXTAUTH_SECRET`
* `NEXTAUTH_URL`

### Realtime (apps/realtime)

If DynamoDB persistence is enabled, configure:

* `AWS_REGION`
* `AWS_ACCESS_KEY_ID`
* `AWS_SECRET_ACCESS_KEY`

And (if you’re using explicit table names):

* `DDB_TABLE_SCORES`
* `DDB_TABLE_LEADERBOARD_SNAPSHOTS`
* `DDB_TABLE_ANNOUNCEMENTS`

> Exact variable names may differ depending on the current implementation inside `apps/realtime`. Use `.env.local` for the web app and `.env` for the realtime app (or standardize as you prefer).

---

## Notes on data storage

Playmasters intentionally avoids a traditional SQL database initially.

* Games list is **code-defined** (deployment-driven content).
* Leaderboards are **in-memory** for low latency.
* DynamoDB is used for **durable persistence** of:

  * score history (optional)
  * leaderboard snapshots (restore on boot)
  * announcements (SSR-friendly and durable)

---

## License

TBD (choose one: MIT, Apache-2.0, proprietary, etc.)

```

---

If you want, I can also generate:
- `CONTRIBUTING.md` (Nx conventions, branching, commit style)
- `.env.example` files for `apps/web` and `apps/realtime`
- A “first-time setup” script section (including DynamoDB local via Docker, if you want that workflow)
```
