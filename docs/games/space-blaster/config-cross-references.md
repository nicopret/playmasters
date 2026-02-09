# Space Blaster Cross-Reference Rules

*(IDs + Referential Integrity — Publish Blocking)*

## 1) Purpose

Space Blaster is built around a data-driven configuration model. Many config artifacts reference entries in other artifacts by ID (e.g., a Level references a FormationLayout). These links must be valid at publish time to guarantee:

* Runtime receives a fully-resolved, self-contained config bundle
* No mid-run failures due to missing content
* Deterministic behavior and safe rollback

**Hard rule:** **No dangling references are allowed in any Published version**.

---

## 2) ID Types

These are the canonical identifier types used across Space Blaster config domains:

* `levelId` — identifies a LevelConfig
* `layoutId` — identifies a FormationLayout
* `enemyId` — identifies an EnemyCatalog entry
* `heroId` — identifies a HeroCatalog entry (player unit)
* `ammoId` — identifies an AmmoCatalog entry
* `scoreKey` / `enemyId` (scoring map key) — keys used by ScoreConfig to map base scores to enemy entries

**ID constraints (recommended validation):**

* IDs are non-empty strings
* IDs are unique within their domain
* IDs are stable (changing an ID is effectively breaking content)

---

## 3) Cross-Reference Rules (Authoritative)

### 3.1 LevelConfig → FormationLayouts

**Rule:** Every LevelConfig must reference an existing FormationLayout by `layoutId`.

* **Reference:** `LevelConfig.layoutId`
* **Target:** `FormationLayouts[layoutId]`

**Publish-blocking validation:**

* Fail publish if `layoutId` is missing
* Fail publish if `layoutId` does not exist in FormationLayouts

**Error example:**

* `LevelConfig(levelId=...) references missing layoutId "layout_alpha"`

---

### 3.2 LevelConfig → EnemyCatalog

**Rule:** Every enemy referenced by any wave in LevelConfig must exist in EnemyCatalog.

* **References (examples—apply to whatever structures exist):**

  * `LevelConfig.waves[].enemies[].enemyId`
  * `LevelConfig.waves[].spawnGroups[].enemyId`
  * Any “boss” reference, if boss is represented by an EnemyCatalog entry
* **Target:** `EnemyCatalog[enemyId]`

**Publish-blocking validation:**

* Fail publish if any referenced `enemyId` does not exist
* Fail publish if a wave references an enemy with invalid structure (e.g., missing enemyId)

**Error example:**

* `Wave[2] references unknown enemyId "enemy_striker_02"`

---

### 3.3 HeroCatalog → AmmoCatalog

**Rule:** Every hero must reference an existing ammo entry.

* **Reference:** `HeroCatalog.entries[].defaultAmmoId` (or equivalent)
* **Target:** `AmmoCatalog[ammoId]`

**Publish-blocking validation:**

* Fail publish if hero references missing `ammoId`

**Error example:**

* `Hero(heroId="pilot") references missing ammoId "laser_basic"`

---

### 3.4 ScoreConfig → EnemyCatalog (Base Score Mapping)

**Rule:** If ScoreConfig contains base scores keyed by enemy id, every key must exist in EnemyCatalog.

* **Reference:** `ScoreConfig.baseScoresByEnemyId` (or equivalent map)
* **Target:** `EnemyCatalog[enemyId]`

**Publish-blocking validation:**

* Fail publish if ScoreConfig contains a score key for an unknown enemyId

**Error example:**

* `ScoreConfig defines base score for unknown enemyId "enemy_ghost"`

**Recommended additional consistency rule (optional but useful):**

* If an enemy is used in any LevelConfig wave, ScoreConfig should define a base score for it (either required or defaulted). If required, it becomes publish-blocking; if defaulted, log a warning.

---

### 3.5 LevelConfig → HeroCatalog (If Explicitly Referenced)

Only applies if LevelConfig selects a hero by ID (some games do).

* **Reference:** `LevelConfig.heroId` (if present)
* **Target:** `HeroCatalog[heroId]`

**Publish-blocking validation:**

* Fail publish if LevelConfig specifies heroId that doesn’t exist

---

### 3.6 Any Domain → Asset Keys (If Required by Runtime Preload)

If your catalogs/configs include `spriteKey`, `sfxKey`, `musicKey`, etc., you should treat these as references to an Asset Registry.

This can be either:

* Publish-blocking (strict), or
* Warning-only (if assets may be delivered separately)

**Recommended approach for Space Blaster:**

* **Publish-blocking for core gameplay assets** (player, grunt, bullet, explosion)
* Warning-only for optional audio/music keys

---

## 4) “No Dangling References” Rule

A config publish must be rejected if:

* Any referenced ID does not exist in its target domain
* Any required ID field is missing
* Any referenced entry exists but violates required shape constraints needed by runtime (e.g., missing `hp` for enemy)

This ensures the runtime `ResolvedGameConfig` can be built without gaps.

---

## 5) Output of Validation (Error Shape)

Validation should return a structured list of errors suitable for Admin UI:

Each error should include:

* `domain`: e.g. `LevelConfig`
* `sourceId`: e.g. `levelId`
* `path`: JSON-path-like pointer to the field, e.g. `waves[2].enemies[0].enemyId`
* `message`: human readable
* `severity`: `error` (publish-blocking) or `warning`

---

## 6) Mapping to Future Validators (How This Becomes Code)

These rules map directly to validator modules:

* `validateLevelLayoutRefs(LevelConfig, FormationLayouts)`
* `validateLevelEnemyRefs(LevelConfig, EnemyCatalog)`
* `validateHeroAmmoRefs(HeroCatalog, AmmoCatalog)`
* `validateScoreEnemyRefs(ScoreConfig, EnemyCatalog)`
* `validateAssetKeys(Catalogs/Configs, AssetRegistry)` (optional)

---
