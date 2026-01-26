## Implement Games Registry + Games Pages

**Task:** Implement Step 2 in `apps/web`: a code-defined games registry, a `/games` listing page, and a `/games/[slug]` game detail page with a placeholder game container + leaderboard panel UI (no realtime or Dynamo yet).

---

### Context

* Nx monorepo
* Next.js app is `apps/web` (App Router)
* Styling is CSS Modules + design tokens from `@playmasters/brand`
* Base UI components may exist in `@playmasters/ui` (Container/Card/Button/Badge/GameTile). Use them if available; otherwise implement minimal local equivalents token-driven.

Step 1 is done (site shell + landing layout). Now we’re adding the **games catalog pages** and the **code registry** that drives them.

  * `Container`, `Card`, `Button`, `Carousel`, `GameTile`, `Badge` (use what exists; if something doesn’t exist yet, use minimal local markup and styles)

## Requirements

### 1) Create a code-defined games registry (source of truth)

Create a shared registry module (choose ONE of these locations depending on repo conventions):

**Preferred:** `packages/games-registry` (as a small Nx lib)
**If you don’t want a new lib yet:** `apps/web/lib/games.ts`

Either way, export:

* `GameStatus = 'available' | 'coming-soon'`
* `Game` type
* `games` array
* helper functions:

  * `getGameBySlug(slug: string): Game | undefined`
  * `getAllGames(): Game[]`

**Game shape:**

```ts
export type Game = {
  id: string;           // stable id
  slug: string;         // route slug
  title: string;
  description: string;
  tags: string[];
  status: 'available' | 'coming-soon';
  thumbnailUrl?: string;  // for now can be undefined
};
```

Populate with **at least 6 placeholder games**:

* 2 marked `available`
* 4 marked `coming-soon`
  Use retro-ish names (e.g., “Space Blaster”, “Neon Runner”, “Pixel Paddles”, “Astro Defender”…).

> Important: Games must be “published” via code deploy, no DB. This registry is the only source of truth.

  * Button text: “Sign in” (link target can be `#` for now)

### 2) Add the `/games` page (Games catalog)

Create route:

* `apps/web/app/games/page.tsx`
* `apps/web/app/games/page.module.css`

Page requirements:

* SSR-friendly (no client-only dependency needed)
* Page header: title “Games”
* Optional subtitle: “Choose a game and climb the leaderboards.”
* Render a responsive grid of games from the registry.
* Each tile should show:

  * title
  * short description
  * tags (Badges)
  * status badge (“Available” / “Coming soon”)
  * CTA:

    * if available: “Play”
    * if coming-soon: disabled “Coming soon”
* Tile links:

  * Always link to `/games/[slug]` (even coming-soon is fine; detail page will show “Coming soon” state)

Use `GameTile` from `@playmasters/ui` if it exists; otherwise implement local `GameCard` component in `apps/web/components/GameCard/*`.

---

### 3) Add the `/games/[slug]` page (Game detail shell)

Create route:

* `apps/web/app/games/[slug]/page.tsx`
* `apps/web/app/games/[slug]/page.module.css`

Behavior:

* Read `slug` from route params
* Load game from registry
* If not found: use `notFound()` (Next.js)

Layout requirements (top to bottom):

1. Title + description
2. Status badge (“Available” or “Coming soon”)
3. **Game container placeholder**

   * A large area (e.g., 16:9-ish box) with:

     * “Game loads here” placeholder text
     * If `coming-soon`, show “Coming soon”
4. **Leaderboard panel UI** (placeholder data)

   * Tabs: **Global**, **Local**, **Personal**
   * Each tab shows a table with columns:

     * Rank
     * Player
     * Score
     * Country (optional)
     * Date
   * For now:

     * If `available`: show **mock entries** (5–10 rows) for Global and Local, and a “Sign in to see your personal best” message for Personal
     * If `coming-soon`: show empty state “No scores yet”
   * Include states:

     * Empty state component
     * “Sign in” placeholder CTA (no auth yet; link `#`)

Implementation notes:

* You can implement tabs using local state (`useState`) inside a small client component like:

  * `apps/web/components/LeaderboardPanel/LeaderboardPanel.tsx` (client component)
* Keep the page itself server component and render `LeaderboardPanel` as a client component.

---

### 4) Update navigation to include `/games` if not already

If header already has a “Games” link, ensure it points to `/games`.

---

### 5) Styling requirements

* All styling must use CSS Modules
* Use brand tokens (CSS variables) only
* Game grid must be responsive:

  * 1 column mobile
  * 2 columns small
  * 3–4 columns desktop
* The game container placeholder should look intentional:

  * dark surface
  * subtle border
  * optional gradient accent or glow token
* Leaderboard table should be readable and consistent with arcade theme:

  * zebra rows optional using tokens (surface variants)

---

## File structure to create (suggested)

```
apps/web/app/games/
  page.tsx
  page.module.css
  [slug]/
    page.tsx
    page.module.css

apps/web/lib/
  games.ts                # if not using packages/games-registry

apps/web/components/
  GameCard/               # only if @playmasters/ui lacks GameTile
  LeaderboardPanel/
    LeaderboardPanel.tsx
    LeaderboardPanel.module.css
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

## Acceptance criteria

* `nx dev web` runs with no errors
* `/games` displays the grid using registry data
* `/games/<slug>` works for all registry items
* Unknown slug returns 404 via `notFound()`
* Page shows:

  * placeholder game container
  * leaderboard tabs + mock data/empty state
* No Tailwind, no MUI, no hardcoded hex colors

---

## Implementation detail suggestions (do this)

* Create mock leaderboard entries in a helper:

  * `apps/web/lib/mockLeaderboards.ts`
* Use stable mock data based on slug (e.g. seeded list) so it doesn’t change on every refresh.
* Keep components small and reusable:

  * `LeaderboardTable` subcomponent is fine.

---

### Output expected

Commit-ready implementation of:

* games registry module
* `/games` page
* `/games/[slug]` page with placeholder game container and leaderboard UI
* any small components required for tiles and leaderboards
