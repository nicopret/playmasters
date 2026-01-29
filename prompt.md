## 🔹 Desktop + Mobile Wrappers with Tauri + Capacitor

**Task:** Implement Step 6 for Playmasters: package the existing web platform into **desktop and mobile applications** using **Tauri (desktop)** and **Capacitor (mobile)**, all inside the existing Nx monorepo.

The goal is:

* One web codebase
* Multiple distribution targets
* No duplicated UI logic
* Shared auth, realtime, and leaderboard behavior

---

# Context

* Nx monorepo
* Existing apps:

  * `apps/web` → public Next.js site (players)
  * `apps/admin` → admin site
  * `apps/realtime` → WebSocket leaderboard service
* Web app already supports:

  * Google auth
  * WebSockets
  * SSR landing page
  * Game pages
* Games are web-based (canvas / Phaser later)
* Styling uses CSS Modules + design tokens

This step adds:

* Desktop wrapper (Windows / macOS / Linux)
* Mobile wrapper (iOS / Android)

---

# Architectural rule (important)

* **apps/web remains the source of truth**
* Desktop and mobile are **thin shells**
* No business logic duplicated
* Auth + leaderboards continue to use:

  * hosted web app
  * or local dev server in development

---

# Part A — Desktop app (Tauri)

## 1) Create desktop app

Generate a new app:

```
apps/desktop
```

This app will:

* Use **Tauri**
* Load the Playmasters web app via:

  * `http://localhost:3000` in dev
  * `https://playmasters.com` in production

Do NOT embed a second copy of the web app unless required.

---

## 2) Initialize Tauri

Inside `apps/desktop`:

* Initialize Tauri using:

  * Rust backend
  * WebView frontend
* Configure `tauri.conf.json` to:

  * Disable unnecessary APIs
  * Enable window resizing
  * Set app name to `Playmasters`
  * Set window size (e.g. 1280×800)

---

## 3) Desktop routing rules

The desktop app should:

* Load:

  * `process.env.PLAYMASTERS_WEB_URL`
* Default dev value:

  * `http://localhost:3000`
* Production value:

  * `https://playmasters.com`

Ensure:

* External links open in system browser
* Auth redirects work correctly
* WebSockets are not blocked by the WebView

---

## 4) Desktop build targets

Add Nx targets for desktop:

* `nx run desktop:dev`
* `nx run desktop:build`

Dev:

* Runs Tauri in dev mode
* Points to local web server

Build:

* Produces platform installers/bundles

---

# Part B — Mobile app (Capacitor)

## 5) Create mobile app

Generate:

```
apps/mobile
```

This app will:

* Use **Capacitor**
* Wrap the Playmasters web app
* Target:

  * iOS
  * Android

---

## 6) Initialize Capacitor

Inside `apps/mobile`:

* Initialize Capacitor project
* App name: `Playmasters`
* App ID: `com.playmasters.app`

Configure Capacitor to:

* Use a **remote web URL**
* Not bundle static web assets initially

---

## 7) Mobile WebView configuration

Mobile app must:

* Load:

  * `process.env.PLAYMASTERS_WEB_URL`
* Support:

  * Google OAuth redirects
  * WebSockets
  * Fullscreen canvas games
* Disable zoom
* Enable landscape orientation for games

---

## 8) Platform setup

Add platforms:

* iOS
* Android

Ensure:

* Correct WebView permissions
* Network permissions enabled
* Cleartext traffic allowed for local dev only

---

## 9) Mobile build targets

Add Nx targets:

* `nx run mobile:ios`
* `nx run mobile:android`
* `nx run mobile:sync`

These should:

* Sync Capacitor config
* Open native IDEs (Xcode / Android Studio)

---

# Part C — Shared configuration

## 10) Environment configuration

Standardize these env vars across apps:

```
PLAYMASTERS_WEB_URL=http://localhost:3000
REALTIME_WS_URL=ws://localhost:4000
```

Ensure:

* Desktop and mobile use the same web + realtime URLs
* No hardcoded localhost values in production

---

## 11) Auth compatibility checks

Verify:

* Google OAuth works inside:

  * Tauri WebView
  * Capacitor WebView
* Redirect URIs include:

  * web domain
  * mobile deep-link scheme if required
* Session cookies are persisted

If needed:

* Add Capacitor/Tauri user agent hints
* Adjust OAuth redirect handling

---

# Part D — Developer experience

## 12) Update workspace scripts

Ensure these workflows work:

```bash
# Web
nx dev web

# Realtime
nx serve realtime

# Desktop
nx run desktop:dev

# Mobile
nx run mobile:sync
nx run mobile:ios
nx run mobile:android
```

---

## 13) Documentation

Update root `README.md`:

Add a section:

### Desktop & Mobile

Explain:

* Architecture (web-first)
* How to run desktop
* How to run mobile
* Environment variables required

---

# Acceptance Criteria

After Step 6:

### Desktop

* Playmasters runs as a native desktop app
* Uses the same web UI and realtime service
* No duplicated UI code
* Auth + leaderboards work

### Mobile

* Playmasters runs on iOS and Android
* Games are playable
* Leaderboards update via WebSockets
* Auth flow completes successfully

### Architecture

* Web remains the single source of truth
* Desktop/mobile are thin wrappers
* Nx monorepo cleanly manages all targets

---

# Deliverables (expected)

**apps/desktop**

* Tauri config
* Nx project.json targets
* README notes

**apps/mobile**

* Capacitor config
* iOS + Android setup
* Nx targets

**Docs**

* Updated root README
* `.env.example` updated with wrapper URLs

