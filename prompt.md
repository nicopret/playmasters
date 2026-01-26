## Implement Website Shell + Landing Page Layout

**Task:** Implement the public website shell in `apps/web`:

* Global layout (header + footer)
* Landing page `/` with the required sections
* Placeholder announcement carousel (no Dynamo yet)
* Use `@playmasters/brand` tokens and `@playmasters/ui` components where appropriate
* CSS Modules only (no Tailwind, no MUI)

---

### Context

* Nx monorepo
* Next.js app at `apps/web` using App Router
* Brand tokens exist:

  * `packages/brand/src/tokens.css`
  * `packages/brand/src/fonts.css`
* UI components exist in `@playmasters/ui` (or will exist):

  * `Container`, `Card`, `Button`, `Carousel`, `GameTile`, `Badge` (use what exists; if something doesn’t exist yet, use minimal local markup and styles)

**Assume `apps/web` imports tokens + fonts globally in `app/layout.tsx`. If not present, add it.**

Logo file is available in the repo as `playmaster_logo.png` (place it in `apps/web/public/` as needed).

---

## Requirements

### 1) Global layout (Header + Footer)

Implement in `apps/web/app/layout.tsx` (or a shared `components/` folder) a consistent site chrome:

#### Header

* Left: Playmasters logo + wordmark link to `/`
* Center or right: navigation links

  * Home (`/`)
  * Games (`/games`) (can exist later, link can be present now)
* Right: Auth placeholder button (no auth yet)

  * Button text: “Sign in” (link target can be `#` for now)

Header should:

* Use dark background tokens
* Use gradient accent (blue→yellow) subtly
* Be responsive:

  * On mobile collapse nav into simple stacked layout (no hamburger needed yet)

#### Footer

* Social links placeholders:

  * Twitch, YouTube, X/Twitter, Discord (href `#` for now)
* Links placeholders:

  * Terms, Privacy, Contact (href `#`)
* Copyright:

  * “© {currentYear} Playmasters”

Footer styling:

* Dark surface with subtle border
* Use brand tokens for spacing and type

---

### 2) Landing page `/` sections

Implement `apps/web/app/page.tsx` with these sections in order:

#### A) Hero carousel (top)

* Use `Carousel` component if available; otherwise implement a minimal local carousel:

  * accepts array of items
  * next/prev buttons
  * dots indicator
  * clamps to max 5 items
* Use placeholder data (3 announcements):

  * id, title, body, ctaLabel, ctaHref, imageUrl (optional)
* Carousel should be large, visually dominant
* Background can use primary gradient or a dark surface with neon accents

#### B) Explanation section (“What is Playmasters?” / “How it works”)

* Title in heading font
* 3 steps layout (cards or columns):

  1. Choose a game
  2. Play instantly
  3. Submit your score & climb the leaderboard

#### C) Games grid (placeholder tiles)

* Title: “Games”
* Show 6 placeholder game tiles using `GameTile` if available; otherwise create local tiles
* Each tile includes:

  * title
  * tags (use badges)
  * status: “Coming soon”
  * CTA button disabled for coming soon

#### D) Social / community callout

* A short block encouraging follows/join community (links are placeholders)

#### E) Footer (already global)

---

### 3) Styling requirements

* Use CSS Modules for all styles in `apps/web`
* Do not introduce Tailwind or Material UI
* Use tokens via CSS variables (no hardcoded hex values)
* Ensure:

  * good contrast
  * responsive layout
  * focus-visible states

Create:

* `apps/web/app/page.module.css`
* `apps/web/components/Header/Header.module.css`
* `apps/web/components/Footer/Footer.module.css`
  (or similar)

---

### 4) File structure (create if missing)

Use this structure:

```
apps/web/app/
  layout.tsx
  page.tsx
  page.module.css

apps/web/components/
  Header/
    Header.tsx
    Header.module.css
  Footer/
    Footer.tsx
    Footer.module.css
  (optional) SectionHeading/
  (optional) PlaceholderCarousel/  # only if Carousel not available
```

Place logo at:

* `apps/web/public/brand/playmaster_logo.png`

Use Next.js `<Image />` for the logo.

---

### 5) Acceptance criteria

After implementation, the following must work:

* `nx dev web`
* Visiting `/` shows:

  * header
  * large carousel with 3 placeholder announcements
  * about/how-it-works section
  * games grid with placeholder tiles
  * social callout
  * footer
* No console errors
* Mobile layout looks acceptable
* Styling uses CSS variables from `@playmasters/brand`

---

### Notes

* Do not implement real auth yet; keep “Sign in” as a placeholder.
* Do not implement DynamoDB or websocket announcements yet.
* If `@playmasters/ui` components are not ready, implement local equivalents in `apps/web` but keep them minimal and token-driven.

---

### Output expected

Commit-ready changes in `apps/web` that establish the full website shell and landing page layout as described.

```
::contentReference[oaicite:0]{index=0}
```
