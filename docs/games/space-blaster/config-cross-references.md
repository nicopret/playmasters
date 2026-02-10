# Space Blaster Versioning, Version Pointers, and Rollback Semantics

## 1. Purpose

Space Blaster content is authored and published through the Playmasters Admin system. The platform must support frequent tuning without rebuilding the game, while preserving:

* deterministic gameplay per run
* safe publishes and rollbacks
* leaderboard fairness and comparability

This document defines the **published version model**, the **version pointer** behavior, how the runtime resolves a version, and how rollbacks work.

---

## 2. Definitions

### Published Artifact

An immutable, validated config document of a given domain, e.g.:

* `GameConfig`
* `LevelConfig[]`
* `HeroCatalog`, `EnemyCatalog`, `AmmoCatalog`
* `FormationLayouts`
* `ScoreConfig`

Once published, an artifact must never change.

### Published Bundle (Space Blaster Config Bundle)

A published “release” of Space Blaster content consisting of a consistent set of domain artifacts that are meant to be used together.

### Version Pointer

A small mutable record that tells the runtime **which published bundle** is “current”. Rollback is performed by repointing this pointer.

### configHash / versionHash

A stable identifier for the published bundle contents. If any artifact in the bundle changes, the hash must change.

(Throughout this doc, `configHash` and `versionHash` are treated as equivalent; choose one naming convention in code.)

---

## 3. Version Model (Bundle-Based)

Space Blaster versioning is **bundle-based**, not per-domain at runtime. The platform publishes a bundle (or a consistent set of domain artifacts) and computes a stable `configHash`.

### Bundle contents (minimum)

A Space Blaster published bundle includes:

* GameConfig
* LevelConfigs (all levels included in that release)
* HeroCatalog
* EnemyCatalog
* AmmoCatalog
* FormationLayouts
* ScoreConfig
* Bundle metadata: `configHash`, `publishedAt`, optional `bundleId`

---

## 4. How Runtime Selects the Published Version

Runtime must resolve the published version in a deterministic sequence:

### Step list (runtime resolution)

1. **Read Version Pointer** for Space Blaster

   * Example: `space-blaster/current` → `bundleId` (or direct artifact ids)

2. **Load Published Bundle** referenced by the pointer

   * This can be a single bundle object, or a manifest containing references to each artifact.

3. **Build ResolvedGameConfig**

   * Resolve all references so runtime receives a **self-contained** object:

     * levels embed the layout and enemy entries they require (or provide complete catalogs + layouts so runtime never fetches elsewhere)
   * Attach `configHash`

4. **Return ResolvedGameConfig to the game at mount/run start**

   * Game boots using only `sdk + resolvedConfig`

---

## 5. configHash / versionHash Semantics

### What the hash represents

`configHash` is a stable identifier for the *exact content* of a published bundle.

* If any field in any included artifact changes → hash changes
* If order-only changes occur (e.g. JSON field order) → hash must remain stable (hash should be computed from a canonical representation)

### Hash generation (recommended)

At publish time:

* canonicalize the bundle manifest and artifact payloads (stable ordering)
* compute hash (e.g. SHA-256)
* store hash alongside the bundle

### Where the hash is used

* **Runtime / RunContext**

  * stored when the run starts
  * never changes during the run
* **Score submission**

  * included in the submission payload so scores can be compared under the same config version
* **Operational debugging**

  * enables reproducing player reports by reloading the exact config bundle

---

## 6. Frozen-Per-Run Guarantee

A run captures and freezes the resolved bundle:

* The run stores `configHash`
* All gameplay tuning during that run is derived from that frozen config
* Publishing a new version while the run is in progress does **not** affect the run

**Effect:** changes apply **next run only**.

---

## 7. Rollback Semantics

Rollback is implemented by repointing the version pointer to a previous published bundle.

### Rollback rules

* Rollback does not delete content
* Rollback does not mutate published artifacts
* Rollback only changes what *new runs* receive
* Active runs remain unaffected (they keep their captured `configHash`)

### Step list (rollback)

1. Admin selects a previous published bundle (by `configHash` / publish date / bundleId)
2. Platform updates the **version pointer** to the selected bundle
3. New sessions resolve the pointer and receive the old bundle
4. Existing sessions continue unchanged

### Safety guarantees

* Pointer update must be atomic
* If pointer update fails, the previous pointer remains intact
* Audit trail must record:

  * who rolled back
  * when
  * from → to bundle id/hash

---

## 8. Diagram (Conceptual)

```
Admin publishes bundle ──► Published Bundle Store (immutable)
        │                          │
        │                          └── bundleId + configHash stored
        │
        └──► Version Pointer: "space-blaster/current" = bundleId
                                   │
Runtime start (new run) ───────────┘
  1) read pointer
  2) fetch bundle
  3) build ResolvedGameConfig (includes configHash)
  4) freeze configHash in RunContext
```

Rollback simply changes `space-blaster/current` to an earlier bundleId.

---
