## 🔹 Separate Admin App + Announcements CRUD + DynamoDB + Public SSR Integration

**Task:** Implement Step 4 for Playmasters by creating a **separate admin application** in the Nx monorepo and implementing the first real admin feature: **Announcements CRUD**, backed by **DynamoDB**, with the public website SSR-fetching announcements for the landing page carousel.

This step establishes:

* a security boundary (separate admin app)
* persistent content management
* SSR data flow from DynamoDB to the public site

---

# Context

* Nx monorepo
* Existing apps:

  * `apps/web` → public site (Next.js App Router)
  * `apps/realtime` → websocket service
* Step 3 completed:

  * Google auth works
  * session includes `user.isAdmin` from allowlist
* Styling:

  * CSS Modules
  * Design tokens from `@playmasters/brand`
* No SQL database.
* DynamoDB is the persistent store.
* Admin must be a **separate Next.js app**:

  * runs on a different port locally (e.g. 3001)
  * deployable to a different server/domain later

---

# High-level goals

By the end of this step:

* `apps/admin` exists as its own Next.js app
* Only admin users can access it
* Admin can:

  * list announcements
  * create announcements
  * edit announcements
  * delete announcements
  * activate/deactivate announcements
  * control sort order
* Max **5 active announcements enforced automatically**
* Public landing page `/` in `apps/web`:

  * SSR-fetches announcements from DynamoDB
  * shows max 5 active
  * falls back to placeholders if Dynamo not configured

---

# Part 1 — Create the admin app

## 1) Generate admin Next.js app

Run (via Codex):

```
nx g @nx/next:app admin --appDir --style=css --no-interactive
```

This creates:

```
apps/admin
```

Requirements:

* App Router enabled
* CSS Modules only
* No Tailwind, no MUI

---

## 2) Global setup for admin app

### Import brand tokens + fonts

In:

```
apps/admin/app/layout.tsx
```

Add at top:

```ts
import '@playmasters/brand/tokens.css'
import '@playmasters/brand/fonts.css'
```

Wrap children in your existing `AuthProvider` (or create one for admin if not shared).

---

## 3) Auth wiring in admin app

Admin app must reuse the **same Google auth config** as `apps/web`.

### Requirements

* Reuse:

  * same Google OAuth app
  * same NEXTAUTH_SECRET
  * same callbacks logic (including `session.user.isAdmin`)
* Admin must deny access globally unless:

  * signed in
  * `session.user.isAdmin === true`

### Implementation

Create (or reuse if shared package already exists):

```
apps/admin/src/auth.ts
apps/admin/app/api/auth/[...nextauth]/route.ts
```

This config must:

* match `apps/web` auth config
* include admin allowlist logic
* export `auth()` helper if you already use one in web

---

## 4) Global admin protection (middleware)

Create:

```
apps/admin/middleware.ts
```

Rules:

* Protect **all routes except**:

  * `/api/auth/*`
* If not signed in → redirect to `/api/auth/signin`
* If signed in but not admin → redirect to `http://localhost:3000/` (public site) or show 403

Use `withAuth` or `auth()` depending on your current Step 3 setup.

This ensures:

* No admin UI ever loads for non-admins
* Admin is a true security boundary

---

# Part 2 — DynamoDB client (shared)

## 5) Create DynamoDB helper (shared location)

Create a reusable Dynamo client module (prefer shared):

**Preferred location:**

```
packages/utils/src/ddb.ts
```

or

```
apps/admin/lib/ddb.ts
```

and copy later to web.

It must:

* Create `DynamoDBClient` with:

  * region from `AWS_REGION`
  * credentials from env
  * optional `endpoint` override if `DDB_ENDPOINT` is set
* Export:

  * `ddbClient`
  * `ddbDocClient` (DocumentClient)

---

## 6) Env variables

Update both:

```
apps/admin/.env.example
apps/web/.env.example
```

Include:

```
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
DDB_ENDPOINT=        # optional, for local Dynamo
DDB_TABLE_ANNOUNCEMENTS=PlaymastersAnnouncements
```

---

# Part 3 — Announcements data layer (shared contract)

## 7) Define Announcement model

Create:

```
packages/types/src/announcement.ts
```

Export:

```ts
export type Announcement = {
  id: string;
  title: string;
  body: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaHref?: string;

  isActive: boolean;
  sortOrder: number;

  createdAt: string;
  updatedAt: string;
};
```

Re-export from `packages/types/index.ts`.

---

## 8) Announcements repository module

Create in admin:

```
apps/admin/lib/announcements.ts
```

This module is the **only place that touches DynamoDB for announcements**.

Implement:

* `listAnnouncements(): Promise<Announcement[]>`
* `getAnnouncement(id: string): Promise<Announcement | null>`
* `createAnnouncement(input: AnnouncementInput): Promise<Announcement>`
* `updateAnnouncement(id: string, input: AnnouncementInput): Promise<Announcement>`
* `deleteAnnouncement(id: string): Promise<void>`
* `setAnnouncementActive(id: string, isActive: boolean): Promise<void>`
* `getActiveAnnouncements(max = 5): Promise<Announcement[]>`

Where:

```ts
type AnnouncementInput = {
  title: string;
  body: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaHref?: string;
  isActive: boolean;
  sortOrder: number;
};
```

### Dynamo schema (simple MVP)

Use:

* PK = `"ANNOUNCEMENTS"`
* SK = `"ANNOUNCEMENT#<id>"`

Store full announcement in attributes.

### Enforce “max 5 active” rule

After any:

* create
* update
* activate

Run:

1. Fetch all active announcements
2. Sort by:

   * sortOrder DESC
   * updatedAt DESC
3. If active count > 5:

   * automatically deactivate overflow announcements
   * persist updates

This guarantees landing page never shows more than 5.

---

# Part 4 — Admin UI (Announcements CRUD)

## 9) Admin routes

Create routes in admin app:

```
apps/admin/app/page.tsx                    # admin dashboard
apps/admin/app/announcements/page.tsx     # list
apps/admin/app/announcements/new/page.tsx
apps/admin/app/announcements/[id]/page.tsx
```

All pages must:

* Assume middleware already enforced admin access
* Still optionally verify session server-side

---

## 10) Admin dashboard `/`

Simple page:

* Title: “Playmasters Admin”
* Links:

  * Announcements
  * (future) Scores
  * (future) Games

---

## 11) Announcements list `/announcements`

Features:

* Table listing all announcements
* Sorted:

  * active first
  * then sortOrder DESC
  * then updatedAt DESC

Columns:

* Title
* Active (toggle checkbox/switch)
* Sort order
* Updated
* Actions: Edit / Delete

Buttons:

* “New announcement”

Actions:

* Toggle active:

  * calls server action or handler
  * enforces max 5 rule
* Delete:

  * confirm()
  * remove from Dynamo

---

## 12) Create page `/announcements/new`

Form fields:

* Title (required)
* Body (required, textarea)
* Image URL (optional)
* CTA label (optional)
* CTA href (optional)
* Sort order (number, default 0)
* Active (checkbox)

Buttons:

* Save
* Cancel (back to list)

On submit:

* Create announcement
* Enforce max-5
* Redirect to list

---

## 13) Edit page `/announcements/[id]`

Same form, prefilled.

Extra buttons:

* Save
* Cancel
* Delete

---

## 14) Backend wiring style

Use **Server Actions** (preferred):

* Each form uses `action={async (formData) => ...}`
* Calls repository functions directly
* After mutations:

  * `revalidatePath('/')`
  * `revalidatePath('/announcements')`

No REST API required for MVP.

---

# Part 5 — Public site integration (apps/web)

## 15) Public announcements reader module

Create:

```
apps/web/lib/announcements.ts
```

This must:

* Use same DynamoDB client logic
* Export:

```ts
export async function getActiveAnnouncements(max = 5): Promise<Announcement[]>
```

Implementation:

* Query Dynamo
* Filter `isActive === true`
* Sort by:

  * sortOrder DESC
  * updatedAt DESC
* Slice to max 5
* Catch errors:

  * log server error
  * return empty array

---

## 16) Update landing page carousel to use Dynamo SSR

In:

```
apps/web/app/page.tsx
```

Replace placeholder announcements with:

```ts
const announcements = await getActiveAnnouncements(5);
```

Behavior:

* If announcements.length > 0 → render carousel from Dynamo
* If announcements.length === 0 → fallback to existing placeholder announcements

Ensure:

* SSR only
* No client fetch
* Max 5 rendered

---

# Styling requirements

* All admin UI styled with CSS Modules
* Use brand tokens (dark surfaces, neon accents)
* Admin UI must be readable and professional:

  * tables with zebra rows optional
  * subtle borders
  * clear form labels

No Tailwind. No MUI.

---

# Acceptance Criteria

After implementation:

### Local dev

* `nx dev web` → runs at `http://localhost:3000`
* `nx dev admin` (or `nx serve admin`) → runs at `http://localhost:3001`

### Admin app

* Visiting `/` in admin:

  * redirects to Google login if not signed in
  * blocks non-admin users
* Admin can:

  * create announcements
  * edit announcements
  * delete announcements
  * toggle active
* More than 5 active announcements is impossible (auto-enforced)

### Public site

* Landing page shows announcements from Dynamo (SSR)
* Max 5 always
* If Dynamo not configured → placeholder carousel still works

### Architecture

* No admin UI code in `apps/web`
* Admin and web fully separated
* Shared types and tokens reused cleanly

---

# Deliverables

Expected new files include:

**Admin app**

* `apps/admin/app/layout.tsx`
* `apps/admin/middleware.ts`
* `apps/admin/app/page.tsx`
* `apps/admin/app/announcements/page.tsx`
* `apps/admin/app/announcements/new/page.tsx`
* `apps/admin/app/announcements/[id]/page.tsx`
* `apps/admin/lib/ddb.ts`
* `apps/admin/lib/announcements.ts`
* admin CSS modules

**Shared**

* `packages/types/src/announcement.ts`

**Public**

* `apps/web/lib/announcements.ts`
* `apps/web/app/page.tsx` updated

**Env**

* `apps/admin/.env.example`
* `apps/web/.env.example` updated
