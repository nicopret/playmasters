### Codex Task: Create Playmasters Design Token System

**Context**

We are building the Playmasters platform.
We use:

* Next.js
* CSS Modules
* Design tokens via CSS variables
* No Tailwind, no framework styling

We have an Nx monorepo with a shared package:

```
packages/brand/
  src/
    tokens.css
    fonts.css
    index.ts
```

Create a production-ready design token file based on the following branding kit:

---

### Branding Kit (source of truth)

**Colors**

* Arcade Yellow — `#F9D65C` (primary text color)
* Electric Blue — `#3AA9E0` (accent and gradient start)
* Crimson Red — `#E94B5A` (button highlights)
* Midnight Black — `#0E0E0E` (background, outline)
* Neon Pink — `#F25C8D` (secondary accent)
* Gradient Purple — `#3B2A6E` (background blend)

**Gradient recommendation**

* Left → right: `#3AA9E0` → `#F9D65C`

**Typography**

* Primary font (headings): Burbank Big Condensed Bold (or closest web-safe fallback)
* Secondary font (body): Montserrat or Poppins

**Brand tone**

* Arcade / neon / bold
* Dark backgrounds
* High contrast

---

### Requirements

Create:

#### 1. `tokens.css`

This must define:

**Color tokens**

* base colors
* semantic colors:

  * background
  * surface
  * text-primary
  * text-secondary
  * accent
  * danger
  * highlight

**Gradients**

* primary gradient (blue → yellow)
* background gradient (purple → black)
* accent gradient (pink → red)

**Typography tokens**

* font families
* font sizes:

  * xs, sm, md, lg, xl, hero
* font weights:

  * regular, medium, bold, black
* line heights:

  * tight, normal, relaxed

**Spacing scale**

* 2xs, xs, sm, md, lg, xl, 2xl

**Radii**

* sm, md, lg, pill

**Shadows / glows**

* card shadow
* neon glow (pink)
* neon glow (blue)
* focus ring

**Z-index layers**

* base
* overlay
* modal
* toast
* tooltip

All tokens must be CSS variables under:

```
:root {
  --pm-...
}
```

Use consistent naming:

* `--pm-color-*`
* `--pm-gradient-*`
* `--pm-font-*`
* `--pm-space-*`
* `--pm-radius-*`
* `--pm-shadow-*`
* `--pm-z-*`

---

#### 2. `fonts.css`

* Define `@font-face` stubs for:

  * Burbank Big Condensed Bold (with fallback stack)
  * Montserrat / Poppins
* Define:

  * `--pm-font-heading`
  * `--pm-font-body`

Do not embed actual font files — just structure and fallback stacks.

---

#### 3. `index.ts`

Export a small helper object so JS/TS code can reference tokens if needed:

Example:

```ts
export const colors = {
  arcadeYellow: 'var(--pm-color-arcade-yellow)',
  electricBlue: 'var(--pm-color-electric-blue)',
  ...
}
```

---

### Design guidelines

* Default background should be dark (`Midnight Black`)
* Text should default to Arcade Yellow or white on dark
* Gradients should be subtle but vivid
* Shadows and glows should feel arcade / neon, not material or corporate
* Keep tokens generic enough for reuse across:

  * landing page
  * game UI overlays
  * leaderboards
  * buttons

---

### Output

Create:

* `packages/brand/src/tokens.css`
* `packages/brand/src/fonts.css`
* `packages/brand/src/index.ts`

All files must be ready to drop into the Nx workspace and import from:

```
import '@playmasters/brand/tokens.css'
import '@playmasters/brand/fonts.css'
```

