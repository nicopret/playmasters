## Implement Google Auth + UI integration + protected routes

**Task:** Implement Google authentication for Playmasters using **Auth.js / NextAuth** in `apps/web` (Next.js App Router). Add sign-in/out UI in the header, session availability across the app, and protect future admin routes.

---

### Context (repo)

* Nx monorepo with `apps/web` (Next.js App Router) and shared packages.
* Styling is CSS Modules + design tokens.
* We do **not** use a SQL database; user identity is Google OAuth.
* Step 1 and Step 2 are already implemented (site shell + games pages).
* We need auth before building admin features.

---

## Requirements

### 1) Add Auth.js / NextAuth with Google Provider

Install dependencies in the workspace root:

* `next-auth`

If needed for TypeScript:

* `@types/node` already exists; don’t add unnecessary types.

Implement NextAuth in App Router using the standard pattern:

Create:

```
apps/web/src/auth.ts            (or apps/web/auth.ts depending on current structure)
apps/web/app/api/auth/[...nextauth]/route.ts
```

Auth configuration requirements:

* Provider: Google
* Session strategy: JWT (default is fine)
* Expose stable user identifier:

  * Use `token.sub` (Google subject) as the platform user id
* Include user info on session:

  * name, email, image
* Add a `callbacks.session` that maps:

  * `session.user.id = token.sub`

Add a simple “admin allowlist” mechanism (for future admin pages):

* Read `PLAYMASTERS_ADMIN_EMAILS` from env (comma-separated)
* In `callbacks.session`, add:

  * `session.user.isAdmin = adminEmails.includes(session.user.email)`

Do NOT add a DB adapter.

---

### 2) Environment variables + example file

Create:

```
apps/web/.env.example
```

Include:

* `GOOGLE_CLIENT_ID=`
* `GOOGLE_CLIENT_SECRET=`
* `NEXTAUTH_SECRET=` (include note to generate with openssl)
* `NEXTAUTH_URL=http://localhost:3000`
* `PLAYMASTERS_ADMIN_EMAILS=you@example.com`

If the repo uses `.env.local`, ensure `.env.example` is referenced in README (optional).

---

### 3) Wire SessionProvider globally

In App Router, use `SessionProvider` from `next-auth/react`, but it must be used in a **client component**.

Create:

```
apps/web/components/AuthProvider/AuthProvider.tsx
```

```tsx
'use client'
import { SessionProvider } from 'next-auth/react'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

Then wrap the app in `apps/web/app/layout.tsx`:

```tsx
<AuthProvider>{children}</AuthProvider>
```

Ensure this does not break SSR layout and does not move global token imports.

---

### 4) Header login/logout UI

Update the header component to show:

**When signed out**

* A “Sign in with Google” button

**When signed in**

* Show user avatar + name (or email if no name)
* A small menu or inline buttons:

  * “Profile” link to `/profile`
  * “Sign out”

Implementation requirements:

* Use `useSession()` from `next-auth/react`
* Use `signIn('google')` and `signOut()`
* Keep it minimal; no external dropdown library needed.
* Use existing UI components (`Button`, `Card`) if available; otherwise simple markup + CSS Modules.

---

### 5) Add a `/profile` page (minimal)

Create:

```
apps/web/app/profile/page.tsx
apps/web/app/profile/page.module.css
```

Behavior:

* If user not authenticated:

  * show “Please sign in” + a sign-in button
* If authenticated:

  * show basic profile:

    * avatar
    * display name
    * email
    * placeholder section: “Your personal bests will appear here.”

Do not implement scores yet.

---

### 6) Protect `/admin` routes with middleware (foundation for Step 4)

Add:

```
apps/web/middleware.ts
```

Requirements:

* Protect any route under `/admin`
* If not signed in → redirect to `/api/auth/signin`
* If signed in but not admin (`session.user.isAdmin !== true`) → redirect to `/` (or show 403 page)

Use NextAuth middleware support (`withAuth`) appropriate for the installed version.

Also protect `/profile` optionally (either via middleware or page logic). It’s OK if `/profile` just shows the sign-in prompt without middleware.

---

### 7) Update “Personal” leaderboard tab message (nice integration)

On the game detail page leaderboard panel (from Step 2):

* If signed out: “Sign in to see your personal best.”
* If signed in: show mock “Personal Best” row (or empty state) with the user’s name.

Do not connect to realtime or Dynamo yet—keep it UI-only.

---

## Acceptance Criteria

* `nx dev web` runs without errors
* Auth flow works locally:

  * click “Sign in with Google” → authenticates → header updates
  * sign out works
* `/profile` displays correct signed-in/signed-out content
* `/admin/*` is protected (redirects when not allowed)
* No database adapter is added
* Code is clean, typed, and uses CSS Modules + tokens (no Tailwind/MUI)

---

## Notes

* Keep auth code isolated and reusable.
* Prefer placing auth config in a single module and importing it from the route handler and middleware.
* Do not implement admin UI yet—only protection scaffolding.

