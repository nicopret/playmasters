# ScoreConfig Editor UX Scope (V1)

## Purpose and V1 Goals

- Allow admins to tune Space Blaster scoring without redeploying code.
- Keep publish readiness explicit and blocking errors actionable before publish.
- Define a concrete UX scope for implementation workstreams #81-#86.

## Schema-Aligned Data Model Summary

Source of truth:

- `packages/types/src/space-blaster/runtime/domains-v1.ts`
- `packages/types/src/space-blaster/schemas/score-config.schema.json`
- `apps/admin/src/app/score-config/validateScoreConfigDraft.ts`
- Runtime behavior: `packages/games/space-blaster/src/scoring/ScoreSystem.ts`

### 1) `baseEnemyScores` (required)

- Path: `scoreConfig.baseEnemyScores[]`
- Shape: `{ enemyId: string; score: number }[]`
- Required for publish: Yes (`minItems: 1` in schema)
- Defaults:
  - Draft save path defaults to `[]` when missing.
  - Runtime fallback for missing enemy mapping uses `EnemyCatalog.entries[].baseScore` (or `0`) when scoring kills.
- Constraints:
  - `enemyId`: non-empty string; must exist in EnemyCatalog for publish readiness/cross-reference.
  - `score`: number >= 0.

### 2) `levelScoreMultiplier` (required)

- Path: `scoreConfig.levelScoreMultiplier`
- Shape: `{ base: number; perLevel: number; max: number }`
- Required for publish: Yes
- Defaults (draft save): `{ base: 1, perLevel: 0, max: 1 }`
- Constraints:
  - Schema: each field >= 0.
  - Editor/publish-readiness (current admin validator):
    - `base >= 1`
    - `perLevel >= 0`
    - `max >= base`

### 3) `combo.tiers` (required as part of `combo`)

- Path: `scoreConfig.combo.tiers[]`
- Shape per tier: `{ minCount: number; multiplier: number; name: string; tierBonus?: number }`
- Required for publish: Yes (`combo` required; `tiers` required and `minItems: 1`)
- Defaults (draft save): `combo` defaults to `{ enabled: false, tiers: [] }`
- Constraints:
  - `minCount >= 1`
  - `multiplier >= 1`
  - `name` non-empty string
  - `tierBonus >= 0` when present
  - Structural/publish validator (`validateScoreConfigTiers`):
    - `minCount` unique
    - tiers sorted ascending by `minCount`

### 4) `waveClearBonus` (required)

- Path: `scoreConfig.waveClearBonus`
- Shape: `{ base: number; perLifeBonus: number }`
- Required for publish: Yes
- Defaults (draft save): `{ base: 0, perLifeBonus: 0 }`
- Constraints:
  - `base >= 0`
  - `perLifeBonus >= 0`
- Runtime behavior note:
  - Wave-clear bonus is applied exactly once per `(levelNumber, waveIndex)` key in `ScoreSystem`.

### 5) `accuracyBonus.thresholds` (optional section, required if `accuracyBonus` exists)

- Path: `scoreConfig.accuracyBonus.thresholds[]`
- Shape per threshold: `{ minAccuracy: number; bonus: number }`
- Required for publish:
  - `accuracyBonus` itself is optional.
  - If present, `thresholds` is required (can be empty array).
- Defaults (draft save): `{ scaleByLevelMultiplier: false, thresholds: [] }`
- Constraints:
  - `minAccuracy` in [0, 1]
  - `bonus >= 0`
  - Editor readiness validator:
    - thresholds sorted ascending by `minAccuracy`
    - no duplicate `minAccuracy`
- Runtime behavior note:
  - Highest threshold met is applied.
  - Accuracy is computed as `shotsHit / max(1, shotsFired)`, so 0 shots => accuracy 0.

## Editable vs Read-Only/Derived in V1

### Editable in V1

- `baseEnemyScores[*].score`
- `levelScoreMultiplier.base`
- `levelScoreMultiplier.perLevel`
- `levelScoreMultiplier.max`
- `combo.tiers[*].minCount`
- `combo.tiers[*].multiplier`
- `combo.tiers[*].tierBonus`
- `combo.tiers[*].name`
- `waveClearBonus.base`
- `waveClearBonus.perLifeBonus`
- `accuracyBonus.thresholds[*].minAccuracy`
- `accuracyBonus.thresholds[*].bonus`

### Read-only in V1 (or preserved if already present)

- `baseEnemyScores[*].enemyId` (catalog-driven row key/label)
- Derived preview values (example multipliers, tier activation notes, threshold-application notes)
- Advanced scoring fields not in #81-#85 scope:
  - `combo.enabled`
  - `combo.minWindowMs`
  - `combo.windowMs`
  - `combo.resetOnPlayerHit`
  - `combo.windowDecayPerLevelMs`
  - `accuracyBonus.scaleByLevelMultiplier`
  - `eventLogSize`
  - `survivalBonus`

## Editor Layout (Page Sections)

Use left-nav sections (or accordion sections) in this order:

1. Base Scores
2. Multipliers
3. Combo Tiers
4. Wave Bonus
5. Accuracy Bonus

Shared page elements:

- Sticky Publish Readiness panel (always visible on desktop)
  - Overall status: Ready / Blocked
  - Error count + section-level counts
  - Jump links to first failing field per section
- Actions:
  - Save Draft
  - Publish
  - Stage only if a staging action already exists in current admin flow

## UI Controls and Interactions

### Base Scores

- Control: table
- Rows: catalog-driven enemy list
  - Enemy label column: read-only (`displayName ?? enemyId`)
  - Score column: number input (`min=0`, integer step)
- Utility action: "Add missing enemy rows" populates any absent catalog enemy with score `0`.
- Validation:
  - Missing score for catalog enemy => blocking error
  - Score < 0 => blocking error
  - Unknown enemyId rows (if present) => blocking error

### Multipliers

- Controls: number inputs
  - `base`
  - `perLevel`
  - `max`
- Optional computed examples panel (read-only): Level 1 / 5 / 10 multiplier preview.
- Validation:
  - `base >= 1` (editor rule)
  - `perLevel >= 0`
  - `max >= base`

### Combo Tiers

- Control: reorderable list/table
- Row fields:
  - `minCount` (number input)
  - `multiplier` (number input)
  - `tierBonus` (number input)
  - `name` (text input)
- Row actions:
  - Add tier
  - Remove tier
  - Move up/down (or drag reorder)
- Validation:
  - `minCount` strictly ascending after sort intent
  - no duplicate `minCount`
  - `multiplier >= 1.0`
  - `tierBonus >= 0`
  - `name` required, non-empty
- UX note:
  - Show helper: "Highest `minCount` reached becomes active tier."

### Wave Bonus

- Controls: number inputs
  - `waveClearBonus.base`
  - `waveClearBonus.perLifeBonus`
- Validation:
  - both >= 0
- Schema note:
  - No enable/disable flag exists for `perLifeBonus` in current ScoreConfig schema.
  - Equivalent "disabled" behavior is `perLifeBonus = 0`.
- Runtime note:
  - Bonus is applied once per wave-clear event key; not repeatedly stackable for the same wave.

### Accuracy Bonus

- Control: table/list
- Row fields:
  - Threshold (`minAccuracy`) shown as percentage input in UI, persisted as decimal [0..1]
  - Bonus (`bonus`) number input
- Row actions:
  - Add threshold
  - Remove threshold
  - Reorder (if allowed)
- Validation:
  - `minAccuracy` must be in [0..1]
  - thresholds sorted ascending
  - no duplicate threshold values
  - `bonus >= 0`
- Rule note:
  - Highest threshold met is applied.
  - 0 shots => accuracy 0.

## Inline Validation and Error Messaging

- Field-level inline errors directly under input controls.
- Section-level badges show error counts.
- Sticky readiness panel aggregates all blocking errors with links.
- Publish is blocked when any blocking error exists.

Message guidelines:

- Keep messages short and actionable.
- Include path context when shown in summary.
- Use admin-friendly wording.

Examples:

- "Missing base score for enemyId 'enemy_grunt'."
- "Max multiplier must be >= base."
- "Duplicate minCount values are not allowed."
- "Accuracy threshold must be between 0 and 1."

## Publish Readiness Criteria (High Level)

A draft is publish-ready when all of the following are true:

- Required ScoreConfig sections are present and schema-valid.
- No structural errors from ScoreConfig readiness validators.
- No cross-reference errors against EnemyCatalog enemy IDs.
- No unresolved blocking issues in readiness panel.

Validation surfacing:

- Immediate inline validation on change/blur.
- Full summary validation on Save and on Publish.
- Publish button disabled or hard-blocked if readiness is not green.

## Out of Scope for V1

- A/B presets or experiment variants
- Per-level score override authoring
- Advanced simulation charts beyond simple numeric examples
- Multi-user locking/conflict resolution
- Editing advanced non-core fields listed as read-only above

## Non-Functional UX Requirements

- No data loss on navigation or refresh after successful save.
- Keyboard-friendly form navigation and row actions.
- Deterministic ordering and stable row identity:
  - base-score rows keyed by `enemyId`
  - combo/accuracy rows use stable row IDs in UI state (not array index only)

## Minimal Valid Example (Schema-Aligned)

```json
{
  "baseEnemyScores": [
    { "enemyId": "enemy_grunt", "score": 100 },
    { "enemyId": "enemy_elite", "score": 200 }
  ],
  "combo": {
    "enabled": true,
    "minWindowMs": 500,
    "resetOnPlayerHit": true,
    "tiers": [
      { "minCount": 2, "multiplier": 1.2, "name": "double", "tierBonus": 0 },
      { "minCount": 4, "multiplier": 1.5, "name": "quad", "tierBonus": 50 }
    ],
    "windowMs": 2000
  },
  "levelScoreMultiplier": { "base": 1, "perLevel": 0.25, "max": 3 },
  "waveClearBonus": { "base": 50, "perLifeBonus": 10 },
  "accuracyBonus": {
    "scaleByLevelMultiplier": false,
    "thresholds": [
      { "minAccuracy": 0.8, "bonus": 20 },
      { "minAccuracy": 0.9, "bonus": 40 }
    ]
  }
}
```

## Mapping to Implementation Tickets

Repository reference check found only `#86` explicitly documented in `docs/admin/content-lifecycle.md`.

- `#81` Base enemy score editor: covered by "Base Scores" section.
- `#82` Level multiplier editor: covered by "Multipliers" section.
- `#83` Combo tier editor: covered by "Combo Tiers" section.
- `#84` Wave bonus editor: covered by "Wave Bonus" section.
- `#85` Accuracy thresholds editor: covered by "Accuracy Bonus" section.
- `#86` Publish readiness + inline validation: covered by "Inline Validation and Error Messaging" and "Publish Readiness Criteria" sections.
