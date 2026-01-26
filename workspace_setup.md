# Playmasters – Nx Monorepo Workspace Setup

This document defines the **exact Nx workspace layout, tooling choices, and project configuration** for Playmasters based on your decisions:

* Nx monorepo
* Next.js web app
* Separate realtime WebSocket service
* CSS Modules + design tokens
* DynamoDB + in‑memory leaderboards
* Games and SDK as shared packages

---

## 1. Tooling baseline

### Required tools

* Node.js 20+
* pnpm (recommended for workspaces)
* Nx (latest)

Install globally (optional):

```
npm install -g nx
```

---

## 2. Create the workspace

Create a fresh integrated Nx workspace:

```
npx create-nx-workspace@latest playmasters
```

Choose:

* Workspace type: **Integrated Monorepo**
* Package manager: **pnpm**
* Preset: **None** (we’ll add apps manually)

Then enter:

```
cd playmasters
```

Install core plugins:

```
pnpm add -D @nx/next @nx/node @nx/js
```

---

## 3. Create base apps

### Web app (Next.js)

```
nx g @nx/next:app web --directory=apps/web --appDir --style=css --no-interactive
```

* Uses App Router
* CSS Modules by default
* SSR ready

This creates:

```
apps/web
```

---

### Realtime service (WebSocket server)

```
nx g @nx/node:app  realtime --directory=apps/realtime --framework=none
```

This creates:

```
apps/realtime
```

This will be your authoritative leaderboard + websocket service.

---

## 4. Create shared packages

### Brand (design tokens, fonts, assets)

```
nx g @nx/js:lib brand --directory=packages/brand --bundler=tsc --importPath=@playmasters/brand
```

Structure:

```
packages/brand/
  src/
    tokens.css
    fonts.css
    index.ts
```

This package is imported once by the web root layout.

---

### UI (reusable components)

```
nx g @nx/js:lib ui --directory=packages/ui --bundler=tsc --importPath=@playmasters/ui
```

Structure:

```
packages/ui/
  src/
    Button/
      Button.tsx
      Button.module.css
    Card/
    GameTile/
    index.ts
```

All components use CSS Modules and brand tokens.

---

### Types (shared contracts)

```
nx g @nx/js:lib types --directory=packages/types --bundler=tsc --importPath=@playmasters/types
```

Used for:

* websocket event payloads
* score submission payloads
* leaderboard entries

---
### Game SDK
```
nx g @nx/js:lib game-sdk --directory=packages/games-sdk --bundler=tsc --importPath=@playmasters/game-sdk
```

Exports:

* WS client
* session helpers
* score submit helpers
* event emitters

---

### Games container

Create folder manually:

```
mkdir -p packages/games
```

Each game is its own Nx library:

```
nx g @nx/js:lib space-blaster --directory=packages/games/space-blaster --importPath=@playmasters/space-blaster
```

Structure per game:

```
packages/games/space-blaster/
  src/
    index.ts
    game.ts
    assets/
```

---

## 5. Final workspace layout

```
playmasters/
  apps/
    web/            # Next.js SSR site + APIs
    realtime/       # WebSocket leaderboard authority

  packages/
    brand/          # tokens, fonts, logo assets
    ui/             # reusable components (CSS Modules)
    types/          # shared TS contracts
    games/
      space-blaster/
      neon-runner/

  nx.json
  tsconfig.base.json
  package.json
```

---

## 6. Base configuration

### nx.json (important parts)

```json
{
  "npmScope": "playmasters",
  "affected": {
    "defaultBase": "main"
  },
  "targetDefaults": {
    "build": {
      "cache": true
    },
    "lint": {
      "cache": true
    }
  }
}
```

---

### tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["DOM", "ES2022"],
    "moduleResolution": "Node",
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@playmasters/brand": ["packages/brand/src/index.ts"],
      "@playmasters/ui": ["packages/ui/src/index.ts"],
      "@playmasters/types": ["packages/types/src/index.ts"]
    }
  }
}
```

---

## 7. Web app wiring

### Import brand tokens

In `apps/web/app/layout.tsx`:

```ts
import '@playmasters/brand/tokens.css'
import '@playmasters/brand/fonts.css'
```

This establishes global theme variables.

---

### Using UI components

```ts
import { Button, Card } from '@playmasters/ui'
```

CSS Modules remain local to the component package.

---

## 8. Realtime service structure

Inside `apps/realtime/src`:

```
index.ts              # bootstrap
server.ts             # http + ws server
leaderboards/
  memory.ts           # in‑memory structures
  restore.ts          # load from Dynamo
  snapshot.ts         # flush to Dynamo
handlers/
  score.ts
  connect.ts
  disconnect.ts
```

Responsibilities:

* maintain in‑memory state
* broadcast updates
* persist snapshots

---

## 9. Build & run targets

### Web

```
nx dev web
nx build web
```

### Realtime

```
nx serve realtime
nx build realtime
```

### Affected builds (CI friendly)

```
nx affected -t build
nx affected -t test
```

---

## 10. CI / Deployment model

### Web

* Deploy `apps/web` only
* Build filter:

```
nx build web
```

### Realtime

* Deploy `apps/realtime` as long‑running Node service

```
nx build realtime
node dist/apps/realtime/main.js
```

### Mobile / Desktop

Later stages:

* Capacitor project lives in `apps/mobile`
* Tauri project lives in `apps/desktop`
* Both consume `apps/web` build output

---

## 11. Rules of the workspace (important)

### Import rules

* Web can import:

  * ui
  * brand
  * types
  * game‑sdk
  * games/*

* Realtime can import:

  * types
  * utils

* Games can import:

  * game‑sdk
  * types

**Never import server code into games or UI.**

---

## 12. What this gives you

* Single repo, many targets
* Shared design tokens everywhere
* Shared SDK for all games
* Independent deployment for web + realtime
* Clean path to mobile + desktop
* Zero Tailwind, zero framework lock‑in

---

This workspace is now ready for:

* DynamoDB integration
* WebSocket protocol definition
* Game SDK implementation
* Landing page UI build
