# LevelConfig Editor – V1 UX Scope (Admin)

## Purpose
- Define the minimum UX needed for admins to author and validate Space Blaster **LevelConfig** records.
- Align with existing schemas and publish validators (schema, structural, cross-reference, fairness). All blocking issues must surface inline before publish.

## Non-goals (v1 boundaries)
- No visual formation grid painter (textual/summary preview only).
- No boss pattern timeline designer; only basic boss presence fields if schema exposes them.
- No analytics/telemetry overlays.
- No bulk import/export beyond existing JSON/source view.
- No per-wave scripting or advanced AI tuning beyond listed knobs.

## Data model snapshot (for editors to reference)
- **LevelConfig** core fields (per schema/validators already in repo):
  - `levelId`, `layoutId`, optional `heroId`
  - `waves`: ordered array; each wave has enemy composition list `{ enemyId, count }` (counts integer ≥ 0; wave total > 0).
  - Optional boss section (if schema supports): must be complete when enabled.
  - Fairness caps/knobs: probabilities in `[0..1]`, `maxConcurrentDivers`, `maxConcurrentShots` ≥ 0, turn-rate bounds when tracking enabled.
  - Cross-refs: `layoutId` → FormationLayouts; `enemyId` → EnemyCatalog; `heroId` → HeroCatalog; hero → `defaultAmmoId` → AmmoCatalog.

## Information Architecture
- **Page header**: Level metadata (levelId, status). Save / Publish buttons with dirty indicator.
- **Left rail**: Wave list (ordered). Add / Duplicate / Remove / Reorder (drag or up/down).
- **Main panels** (tabs or accordions):
  1) **Layout & Core**: layout select + formation summary, core movement/fire knobs, hero override.
  2) **Waves**: per-wave editor (composition + wave-level knobs if present).
  3) **Boss** (optional): only if schema exposes boss fields.
  4) **Validation**: summary of blocking errors/warnings with deep-link to fields.

## Wave list UX (Acceptance #1)
- Show waves as “Wave 1, Wave 2, …” with counts badge (total enemies).
- Controls:
  - **Add wave**: appends new empty wave (prefill first enemy row blank). Disabled during save.
  - **Duplicate wave**: clones selected wave (including composition + knobs). Optional but recommended.
  - **Remove wave**: confirms if wave has enemies.
  - **Reorder**: drag handle or Up/Down buttons; updates labels live.
- Wave editor (right pane when selected):
  - Composition table: rows of `{ enemyId select, count number input }`.
  - Buttons: Add row / Remove row.
  - Inline rules: count must be integer ≥ 0; wave total > 0 → show error “Wave must contain at least one enemy” near table and in header badge.
  - If schema supports wave-level probabilities/caps, render numeric inputs with min/max shown.

## Formation selection + core knobs (Acceptance #2)
- **Layout selector**: searchable dropdown from FormationLayouts. Show summary chip: `rows x cols`, `hSpacing/vSpacing`. If missing, show cross-ref error inline.
- **Core movement/fire controls** (map to actual LevelConfig fields):
  - Speed / descend / boundary reversal: numeric inputs with units; sliders if helpful. Min 0 where applicable.
  - Dive settings: probability `[0..1]`, `maxConcurrentDivers` ≥ 0, cooldowns (ms) ≥ 0.
  - Fire settings: probability/rate `[0..1]`, `maxConcurrentShots` ≥ 0, cooldowns (ms) ≥ 0.
  - Turn rate (if tracking): numeric with max cap constant from validator; show tooltip “Prevents perfect tracking; max = {cap}”.
  - Each knob supports “Reset to inherited default” if value differs from base/GameConfig.

## Validation surface (Acceptance #3)
- Layers and messages:
  - **Schema**: required/shape/out-of-range → shown at field level.
  - **Structural**: waves ≥ 1; wave total > 0; boss completeness → shown at section and field, plus badge in rail.
  - **Cross-reference**: missing `layoutId`, `enemyId`, `heroId`, `ammoId` → field-level errors with referenced id.
  - **Fairness**: probability bounds, caps non-negative, turnRate cap → field-level errors.
- Presentation:
  - Field-level inline text (one line, actionable).
  - Section header badge with error count.
  - Global “Validation” panel listing issues; clicking scrolls/focuses target field. Distinguish **error (publish-blocking)** vs **warning** styles.

## Component inventory (for engineers)
| Component | Purpose | Fields | Validation hooks | Data sources |
| --- | --- | --- | --- | --- |
| `WaveList` | List + reorder waves | `waves` | structural: waves ≥1 | LevelConfig draft |
| `WaveEditor` | Edit selected wave rows | `waves[i].enemies[].enemyId/count` | structural (count ≥0, total>0); cross-ref enemyId | EnemyCatalog |
| `WaveRow` | Single enemy row | enemyId select, count input | count integer ≥0 | EnemyCatalog |
| `LayoutSelect` | Choose formation layout | `layoutId` | cross-ref layoutId | FormationLayouts |
| `FormationSummary` | Show rows/cols/spacing | read-only | — | FormationLayouts |
| `CoreKnobs` | speed/descend/dive/fire/turnRate | mapped numeric inputs | fairness bounds | LevelConfig fields |
| `HeroSelect` (optional) | choose hero | `heroId` | cross-ref heroId | HeroCatalog |
| `ValidationPanel` | list of issues | all | displays publish-blocking vs warning | validators output |

## State & flow
- Draft state stored in form; “Dirty” indicator when diverging from loaded LevelConfig.
- Validation runs on blur/change for field-level, and full pass on Save/Publish.
- Save keeps draft; Publish triggers server validation pipeline (schema + business rules).
- Optional undo/redo (not required for v1).

## V1 defaults & ranges (align with validators)
- Probabilities: 0–1 step 0.01.
- Counts/caps: min 0, integer.
- Turn rate: min 0, max = validator cap (documented in fairness validator).
- Wave must have ≥1 row and total count > 0.
- Layout select required; enemyId select required per row.

## Acceptance test mapping
- **Wave list add/reorder/remove** → “Wave list UX” section; components `WaveList`, `WaveEditor`.
- **Formation selection + core knobs (speed/descend/dive/fire)** → “Formation selection + core knobs” and `LayoutSelect`/`CoreKnobs` components.
- **Validations surfaced inline** → “Validation surface” section and `ValidationPanel` behavior.
