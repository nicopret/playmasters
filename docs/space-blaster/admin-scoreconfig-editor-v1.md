# ScoreConfig Editor – V1 UX Scope (Admin)

## Overview
- Purpose: enable admins to tune Space Blaster scoring safely while preserving leaderboard comparability.
- Audience: Admin operators and frontend engineers implementing the editor.
- Validation chain: client inline validation + server publish validators (#71 score tiers, #70 fairness ranges, cross-ref). Errors use `{ severity, stage, domain, path, message }`.
- Frozen-per-run: validated configs must be stable before publish; UI should prevent publish when blocking issues exist.

## Information Architecture
1. Base Scores
2. Level Multipliers
3. Combo Tiers
4. Wave Bonus
5. Accuracy Thresholds
6. Validation & Publish Readiness (shared summary panel, same pattern as LevelConfig #79)

## Field Scope (v1)
### 1) Base scores map
- UI: table/grid; rows: `enemyId` (from EnemyCatalog) + `baseScore` (number/int).
- Features: search/filter enemyId; optional “add missing enemy” if allowed; unknown enemyIds blocked.
- Validation: `baseScore >= 0`; enemyId required and must exist in EnemyCatalog (cross-ref error: “enemyId '<id>' not found in EnemyCatalog.”).

### 2) Level multipliers
- UI: numeric inputs (with optional enable toggle if schema supports). Fields (adapt to actual model):
  - `baseMultiplier` (>= 1.0)
  - `incrementPerLevel` (>= 0)
  - `maxMultiplier` (>= 1.0 and >= base)
- Validation: enforce bounds inline; show units/notes (multiplier). Message examples: “baseMultiplier must be >= 1.0.”

### 3) Combo tiers (ties to server rule #71)
- UI: ordered list/table with add/remove/reorder (up/down or drag).
- Fields: `minCount` (int >= 1), `multiplier` (>= 1.0), `tierBonus` (>= 0), optional `label`.
- Behaviors: add tier, remove tier, reorder; optional auto-sort helper.
- Validation (must surface inline & in summary):
  - Sorted by `minCount` ascending.
  - No duplicate `minCount`.
  - `multiplier >= 1.0`; `tierBonus >= 0`.
  - Example message: “Combo tiers must be sorted by minCount (tier 3 has 10 after 15).”

### 4) Wave bonus
- UI: numeric inputs (per-wave clear bonus, optional scaling).
- Validation: values >= 0; message “wave bonus must be >= 0.”

### 5) Accuracy thresholds
- UI: table of thresholds + rewards; display as percentages, store as [0..1].
- Fields: `minAccuracy` (0..1), `bonus` (>=0) or `multiplier` per actual model.
- Validation: thresholds sorted ascending, no duplicates; `minAccuracy` within [0..1]; `bonus>=0`.
- Example message: “Accuracy threshold must be between 0 and 1 (got 1.2).”

### 6) Validation & Publish Readiness
- Inline errors on fields/rows; section badges with counts.
- Global summary lists blocking issues; clicking focuses field.
- Ready when no blocking issues; otherwise publish disabled (or staged-blocked) with message “Fix errors before publishing.”
- Warning banner (non-blocking): “Scoring changes may impact leaderboard comparability.”

## Inline Validation Patterns
- Field-level text under inputs; row-level inline for tables; summary panel aggregates `{path,message}`.
- Error templates:
  - “layoutId is required.” (if reused via shared validator)
  - “baseScore must be >= 0.”
  - “enemyId '<id>' not in EnemyCatalog.”
  - “minCount must be unique (duplicate: {value}).”
  - “Combo tiers must be sorted by minCount (tier index {i} before {i-1}).”

## Non-goals (v1)
- No balance simulation or DPS/TTK previews.
- No bulk import/export beyond JSON view.
- No season/leaderboard segmentation controls.
- No automated enemy coverage checker if schema doesn’t require full coverage.

## Component Inventory (implementation mapping)
| Component | Fields/Path | Validations | Data deps | Notes |
| --- | --- | --- | --- | --- |
| `BaseScoreTable` | `baseScores[enemyId]` | baseScore >=0; enemyId exists | EnemyCatalog | readonly enemyId column + score input |
| `LevelMultiplierPanel` | `multipliers.*` | bounds per above | none | optional enable toggle if schema supports |
| `ComboTierList` | `comboTiers[]` | sort, unique minCount, multiplier>=1, tierBonus>=0 | none | add/remove/reorder |
| `WaveBonusInputs` | `waveBonus.*` | >=0 | none | simple inputs |
| `AccuracyTable` | `accuracyThresholds[]` | 0..1, sorted, unique, bonus>=0 | none | display %; store fraction |
| `ValidationSummary` | issues[] | render severity/path/message | all | shares model with LevelConfig validator |

## Wireframe Notes (lightweight)
- Panel stack order: Base Scores → Level Multipliers → Combo Tiers → Wave Bonus → Accuracy → Validation summary.
- Each table supports add/remove row buttons; up/down for ordered lists (combo tiers, thresholds).

## Acceptance Test Coverage
- Base scores map → Section “Base scores map”
- Level multiplier settings → Section “Level multipliers”
- Combo tiers → Section “Combo tiers”
- Wave bonus → Section “Wave bonus”
- Accuracy thresholds → Section “Accuracy thresholds”
