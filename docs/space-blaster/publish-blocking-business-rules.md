# Space Blaster Publish-Blocking Business Rules (Authoritative Inventory)

Parent issue: #13 • Task: #67  
Scope: publish-time, *blocking* rules for Space Blaster configuration. This is a spec + mapping to validator entrypoints; it does **not** change schema requirements.

## 1. Stages & Severity
- **schema** – JSON Schema enforcement (shape/type). Already covered by the `*.schema.json` files.
- **structural** – logical constraints inside a single domain artifact.
- **cross-reference** – referential integrity between domains.
- **resolution** – invariants after applying overrides/merges.
- **assets** – required asset keys present & typed.

Severity: all rules here are **publish-blocking** (`severity: "error"`). Warnings are out of scope.

Error model (reused):  
`{ severity: 'error', stage, domain, sourceId?, path, message }`

## 2. Validator Naming Convention
Each rule maps to a validator that returns `ValidationIssue[]`. Suggested signature:
`validateX(input, context): ValidationIssue[]`

`domain` = one of `GameConfig | LevelConfig | HeroCatalog | EnemyCatalog | AmmoCatalog | FormationLayouts | ScoreConfig`.

## 3. Rule Inventory (complete)
Tables list: **Rule ID • Stage • Domain • Condition • Error template • Path hint • Validator**

### 3.1 Schema (shape) — summarized
Handled by JSON Schemas; no additional validators.  
Validator: `validateSchema(domain, schema, payload)` (existing).

### 3.2 Structural Rules
- **SB-STRUCT-LEVEL-001** • structural • LevelConfig • Must have ≥1 wave. • `LevelConfig(levelId={levelId}) must contain at least 1 wave.` • `waves` • `validateLevelHasWaves`
- **SB-STRUCT-LEVEL-002** • structural • LevelConfig • Each wave count is integer ≥1. • `LevelConfig(levelId={levelId}) wave[{index}].count must be >= 1 (got {count}).` • `waves[{i}].count` • `validateWaveCounts`
- **SB-STRUCT-LEVEL-003** • structural • LevelConfig • enemyId in each wave is non-empty string. • `LevelConfig(levelId={levelId}) wave[{index}].enemyId is required.` • `waves[{i}].enemyId` • `validateWaveEnemyIds`
- **SB-STRUCT-LEVEL-004** • structural • LevelConfig • dive/shooting/speed/scoreMultiplier within 1–100 if present. • `LevelConfig(levelId={levelId}) {field} must be between 1 and 100 (got {value}).` • `{field}` • `validateLevelRanges`
- **SB-STRUCT-LEVEL-005** • structural • LevelConfig • If boss=true then waves is non-empty. • `LevelConfig(levelId={levelId}) boss level must define waves.` • `waves` • `validateBossHasWaves`
- **SB-STRUCT-ENEMY-001** • structural • EnemyCatalog • hp integer ≥1. • `EnemyCatalog(enemyId={enemyId}) hp must be > 0 (got {hp}).` • `entries[{i}].hp` • `validateEnemyHp`
- **SB-STRUCT-ENEMY-002** • structural • EnemyCatalog • speed, baseScore, cooldowns ≥0. • `EnemyCatalog(enemyId={enemyId}) {field} must be >= 0 (got {value}).` • `entries[{i}].{field}` • `validateEnemyNumericBounds`
- **SB-STRUCT-AMMO-001** • structural • AmmoCatalog • projectileSpeed, fireCooldownMs, damage ≥0. • `AmmoCatalog(ammoId={ammoId}) {field} must be >= 0 (got {value}).` • `entries[{i}].{field}` • `validateAmmoNumericBounds`
- **SB-STRUCT-HERO-001** • structural • HeroCatalog • maxLives integer ≥1; moveSpeed ≥0. • `HeroCatalog(heroId={heroId}) {field} must be >= {min} (got {value}).` • `entries[{i}].{field}` • `validateHeroBounds`
- **SB-STRUCT-FORM-001** • structural • FormationLayouts • rows, columns ≥1; spacing.x, spacing.y ≥0. • `FormationLayouts(layoutId={layoutId}) {field} must be >= {min} (got {value}).` • `entries[{i}].{field}` • `validateFormationBounds`
- **SB-STRUCT-SCORE-001** • structural • ScoreConfig • combo tiers: minCount ≥1, multiplier ≥1, tierBonus ≥0. • `ScoreConfig combo tier[{index}] {field} must be >= {min} (got {value}).` • `combo.tiers[{i}].{field}` • `validateScoreComboTiers`
- **SB-STRUCT-SCORE-002** • structural • ScoreConfig • accuracy thresholds minAccuracy ∈ [0,1], bonus ≥0. • `ScoreConfig accuracyThreshold[{index}] {field} invalid (got {value}).` • `accuracyBonus.thresholds[{i}].{field}` • `validateScoreAccuracyThresholds`
- **SB-STRUCT-SCORE-003** • structural • ScoreConfig • waveClearBonus base/perLifeBonus ≥0; levelScoreMultiplier base/max/perLevel ≥0. • `ScoreConfig {field} must be >= 0 (got {value}).` • `{field}` • `validateScoreNumericBounds`
- **SB-STRUCT-GAME-001** • structural • GameConfig • defaultLives integer 1–9. • `GameConfig defaultLives must be between 1 and 9 (got {value}).` • `defaultLives` • `validateGameConfigBounds`
- **SB-STRUCT-GAME-002** • structural • GameConfig • timing.comboWindowMs ≥100. • `GameConfig timing.comboWindowMs must be >= 100 (got {value}).` • `timing.comboWindowMs` • `validateGameTiming`

### 3.3 Cross-Reference Rules
- **SB-XREF-LEVEL-001** • cross-reference • LevelConfig • layoutId exists in FormationLayouts. • `LevelConfig(levelId={levelId}) references missing layoutId '{layoutId}'.` • `layoutId` • `validateLevelLayoutRef`
- **SB-XREF-LEVEL-002** • cross-reference • LevelConfig • wave enemyId exists in EnemyCatalog. • `LevelConfig(levelId={levelId}) wave[{index}] enemyId '{enemyId}' not found in EnemyCatalog.` • `waves[{i}].enemyId` • `validateLevelEnemyRefs`
- **SB-XREF-LEVEL-003** • cross-reference • LevelConfig • enemyTypes entries exist in EnemyCatalog. • `LevelConfig(levelId={levelId}) enemyTypes '{enemyId}' not found in EnemyCatalog.` • `enemyTypes[{i}]` • `validateLevelEnemyTypes`
- **SB-XREF-HERO-001** • cross-reference • HeroCatalog • defaultAmmoId exists in AmmoCatalog. • `HeroCatalog(heroId={heroId}) defaultAmmoId '{ammoId}' not found in AmmoCatalog.` • `entries[{i}].defaultAmmoId` • `validateHeroAmmoRef`
- **SB-XREF-SCORE-001** • cross-reference • ScoreConfig • baseEnemyScores enemyId exists in EnemyCatalog. • `ScoreConfig baseEnemyScores[{index}] enemyId '{enemyId}' not found in EnemyCatalog.` • `baseEnemyScores[{i}].enemyId` • `validateScoreEnemyRefs`
- **SB-XREF-FORM-001** • cross-reference • FormationLayouts vs LevelConfig • Formation capacity >= any wave count? *(optional structural)* If enforced: `LevelConfig(levelId={levelId}) wave[{index}] count {count} exceeds formation capacity {capacity} for layout '{layoutId}'.` • `waves[{i}].count` • `validateFormationCapacity`

### 3.4 Resolution Rules
Applied after merging Catalog → GameConfig → LevelConfig (and difficulty mods if present):
- **SB-RESOLVE-001** • resolution • LevelConfig • Required fields remain after overrides (layoutId, waves enemyId/count). • `Resolved LevelConfig(levelId={levelId}) missing required field '{field}'.` • `{field}` • `validateResolvedLevelRequired`
- **SB-RESOLVE-002** • resolution • No unknown override keys applied. • `Resolved config contains unsupported override '{path}'.` • `{path}` • `validateNoUnknownOverrides`
- **SB-RESOLVE-003** • resolution • Final numeric bounds still satisfied (reuse structural bounds on resolved object). • `Resolved {domain} {path} out of bounds (got {value}).` • `{path}` • `validateResolvedBounds`

### 3.5 Asset Rules
- **SB-ASSET-001** • assets • HeroCatalog • spriteKey required and non-empty. • `HeroCatalog(heroId={heroId}) missing spriteKey.` • `entries[{i}].spriteKey` • `validateHeroAssets`
- **SB-ASSET-002** • assets • EnemyCatalog • spriteKey required and non-empty. • `EnemyCatalog(enemyId={enemyId}) missing spriteKey.` • `entries[{i}].spriteKey` • `validateEnemyAssets`
- **SB-ASSET-003** • assets • AmmoCatalog • spriteKey required and non-empty. • `AmmoCatalog(ammoId={ammoId}) missing spriteKey.` • `entries[{i}].spriteKey` • `validateAmmoAssets`
- **SB-ASSET-004** • assets • LevelConfig • All enemies referenced by levels must have spriteKey (derived check). • `LevelConfig(levelId={levelId}) enemyId '{enemyId}' lacks spriteKey in EnemyCatalog.` • `waves[{i}].enemyId` • `validateLevelEnemyAssets`
- **SB-ASSET-005** • assets • Optional audio keys when required by gameplay (fireSfxKey etc.) must be string if present. • `{Domain}({id}) {field} must be a non-empty string when provided.` • `{field}` • `validateOptionalAssetKeys`

## 4. Validator Registry (proposed wiring)
Stage → validators:
- schema: `validateSchema`
- structural: `validateLevelHasWaves`, `validateWaveCounts`, `validateWaveEnemyIds`, `validateLevelRanges`, `validateBossHasWaves`, `validateEnemyHp`, `validateEnemyNumericBounds`, `validateAmmoNumericBounds`, `validateHeroBounds`, `validateFormationBounds`, `validateScoreComboTiers`, `validateScoreAccuracyThresholds`, `validateScoreNumericBounds`, `validateGameConfigBounds`, `validateGameTiming`
- cross-reference: `validateLevelLayoutRef`, `validateLevelEnemyRefs`, `validateLevelEnemyTypes`, `validateHeroAmmoRef`, `validateScoreEnemyRefs`, `validateFormationCapacity`
- resolution: `validateResolvedLevelRequired`, `validateNoUnknownOverrides`, `validateResolvedBounds`
- assets: `validateHeroAssets`, `validateEnemyAssets`, `validateAmmoAssets`, `validateLevelEnemyAssets`, `validateOptionalAssetKeys`

All validators should return `ValidationIssue[]` with the canonical fields listed above.

## 5. Error Message Guidance
- Include domain + identifier (`levelId`, `enemyId`, `heroId`, `ammoId`, `layoutId`).
- Keep messages short, actionable, and stable.
- `path` should point to the offending JSON pointer (dot or bracket form as used in existing validators).

## 6. Coverage Checklist vs Acceptance Tests
- **Complete rule list (refs, ranges, logical)**: Sections 3.2–3.5.
- **Clear error message format**: Each rule row contains a canonical template + path hint.
- Cross-reference, ranges, structural, resolution, asset rules all enumerated.
- Mapping to validator function names supplied per rule and registry in §4.

## 7. Next Steps (implementation notes)
- Confirm existing validator files; implement functions named above or map to current ones.
- Wire registry into publish pipeline to execute in stage order: schema → structural → cross-reference → resolution → assets.
- Reuse the established error model; keep `severity: 'error'` for publish-blocking findings.
