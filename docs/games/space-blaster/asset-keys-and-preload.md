# Space Blaster Asset Reference Model & Preload Requirements

## 1) Purpose

Space Blaster configuration is data-driven and authored in Admin. Catalogs and configs reference visual and audio assets by stable keys so that:

* content can be tuned/published without rebuilding the game
* runtime can preload deterministically
* gameplay never stalls due to network or dynamic asset loads during PLAYING

This document defines the **asset key model**, where keys appear in config domains, and the runtime preload rules.

---

## 2) Key Principles

1. **Config references assets by key, never by file path**

* Keys are stable identifiers; mapping to actual files is runtime/platform-specific.

2. **All gameplay-critical assets must be preloaded before PLAYING**

* No runtime fetches mid-wave.
* All sprite sheets, textures, SFX used during play must be loaded during BOOT/READY.

3. **Asset keys should be validated early**

* Missing keys should fail fast at boot (or at publish for core keys if possible).

4. **Assets must be compatible with rollback**

* If a config version is rolled back, the referenced asset keys must still exist and load successfully.

---

## 3) Asset Key Types

Space Blaster uses the following key classes:

### 3.1 Sprite Keys

Used for anything rendered in the playfield or HUD.

Examples:

* `sprite.player.ship.v1`
* `sprite.enemy.grunt.v1`
* `sprite.enemy.elite.v1`
* `sprite.projectile.player.laser.v1`
* `sprite.fx.explosion.small.v1`
* `sprite.ui.icon.life.v1`

### 3.2 Audio Keys

Used for SFX and music.

Examples:

* `sfx.player.fire.v1`
* `sfx.player.hit.v1`
* `sfx.enemy.explode.v1`
* `sfx.combo.tierup.v1`
* `sfx.alert.dive.v1`
* `music.main.loop.v1`
* `music.boss.loop.v1`

### 3.3 Optional UI Theme Keys (If supported)

Used for HUD layout variants or themed UI components.

Examples:

* `ui.theme.default.v1`
* `ui.font.pixel.v1`

If UI theme keys are not supported by platform, omit this type.

---

## 4) Where Asset Keys Live in Config

Asset keys should exist in these domains.

### 4.1 HeroCatalog (Player Unit)

Fields (examples):

* `spriteKey`
* `hurtFlashSpriteKey` (optional)
* `engineTrailFxKey` (optional)
* `fireSfxKey`
* `hitSfxKey`

**Minimum required keys for gameplay:**

* `spriteKey`
* `fireSfxKey` (optional if silent allowed)

---

### 4.2 EnemyCatalog

Fields (examples):

* `spriteKey`
* `explodeFxKey` (optional: otherwise use global explosion)
* `fireSfxKey` (optional)
* `diveTelegraphSfxKey` (recommended)
* `deathSfxKey` (optional)

**Minimum required keys for gameplay:**

* `spriteKey`

---

### 4.3 AmmoCatalog

Fields (examples):

* `spriteKey`
* `fireSfxKey` (optional)
* `impactFxKey` (optional)

**Minimum required keys for gameplay:**

* `spriteKey` (if projectile is visible)

---

### 4.4 GameConfig / Presentation Defaults

Fields (examples):

* `backgroundSpriteKey`
* `globalExplosionFxKey`
* `uiHudThemeKey`
* `musicKeyMain`
* `musicKeyResults`

**Minimum required keys for gameplay:**

* `globalExplosionFxKey` (if not overridden elsewhere)

---

### 4.5 HUD/UI Config (If separated)

Fields (examples):

* `lifeIconSpriteKey`
* `fontKey`
* `comboBannerSpriteKey` (optional)

---

## 5) Naming & Versioning Conventions for Keys

Recommended conventions:

* hierarchical names: `sprite.enemy.grunt.v1`
* do not encode file extensions
* include a version suffix (`v1`, `v2`) for safe evolution
* treat keys as stable API contracts once used in published configs

**Key stability rule:** once a key appears in a published bundle, it must remain loadable to support rollback and replay comparisons.

---

## 6) Preload Requirements (Runtime)

### 6.1 When Preloading Happens

Assets must be loaded during:

* `BOOT` / `READY` states (before `COUNTDOWN` / `PLAYING`)

### 6.2 What Must Be Preloaded

All keys referenced by the resolved config that are required for gameplay:

**Gameplay-critical sprites**

* player ship sprite
* all enemy sprites for enemies used in the current level set
* projectile sprites
* explosion sprites / FX

**Gameplay-critical audio (recommended)**

* player fire SFX
* enemy explode SFX
* dive telegraph SFX
* UI tier-up SFX

**Optional (can be delayed until menus/results)**

* results music
* settings UI sounds

### 6.3 No Dynamic Loading During PLAYING

During `PLAYING`:

* no network requests for assets
* no incremental loading of sprite sheets
* no “lazy load” of new enemies mid-wave

If a level references an enemy sprite not preloaded:

* this is a boot-time failure (preferred)
* or a publish-time failure for strict pipelines

---

## 7) How to Derive the Preload List

Given `ResolvedGameConfig`, the preload list is computed as:

1. Collect all sprite keys from:

* `heroCatalog`
* `enemyCatalog`
* `ammoCatalog`
* `gameConfig` presentation keys
* HUD keys (if present)

2. Collect all audio keys from:

* `heroCatalog`
* `enemyCatalog`
* `ammoCatalog`
* `gameConfig` music + global SFX keys

3. Deduplicate keys

4. Load assets by key through the platform asset loader (implementation-specific)

This derivation must be deterministic and purely config-driven.

---

## 8) Versioning & configHash Relationship

Assets are part of the runtime experience but may not be embedded in configHash depending on platform architecture.

Two acceptable models:

### Model A (Recommended): Keys are versioned; hash covers config content only

* `configHash` changes when keys change (because the config changes)
* asset files are expected to exist for keys referenced by that version
* rollback works because old keys remain valid

### Model B: Assets are part of the bundle manifest

* published bundle includes an asset manifest
* hash includes both config + asset manifest

Either model is acceptable as long as rollback guarantees are upheld.

**Minimum guarantee:** For any published configHash, all referenced keys must load successfully.

---

## 9) Validation Rules

### Publish-time validation (preferred for core gameplay)

Fail publish if:

* any required spriteKey is missing
* any catalog entry references a malformed key
* any level references an enemy that lacks a spriteKey

### Boot-time validation (required regardless)

Fail boot if:

* any required key fails to load
* asset loader returns missing/invalid resource for a critical key

Error messages should specify:

* domain + id (enemyId/heroId/ammoId)
* missing key name
* key value

Example:

* `EnemyCatalog(enemyId="grunt") missing spriteKey`
* `Failed to load spriteKey "sprite.enemy.grunt.v1"`

---
