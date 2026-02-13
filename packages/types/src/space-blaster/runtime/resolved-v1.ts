export interface GameConfigV1 {
  defaultLives: number;
  timing: {
    comboWindowMs: number;
  };
}

export interface LevelWaveV1 {
  enemyId: string;
  count?: number;
  spawnDelayMs?: number;
}

export interface ResolvedLevelConfigV1 {
  levelId?: string;
  layoutId: string;
  boss?: boolean;
  dive?: number;
  enemyTypes?: string[];
  scoreMultiplier?: number;
  shooting?: number;
  speed?: number;
  waves?: LevelWaveV1[];
}

export interface HeroCatalogEntryV1 {
  heroId: string;
  spriteKey: string;
  hurtFlashSpriteKey?: string;
  engineTrailFxKey?: string;
  fireSfxKey?: string;
  hitSfxKey?: string;
  defaultAmmoId: string;
  moveSpeed: number;
  maxLives: number;
  hitbox: {
    width: number;
    height: number;
  };
}

export interface HeroCatalogV1 {
  entries: HeroCatalogEntryV1[];
}

export interface EnemyCatalogEntryV1 {
  enemyId: string;
  hp: number;
  spriteKey: string;
  fireSfxKey?: string;
  deathSfxKey?: string;
  diveTelegraphSfxKey?: string;
  explodeFxKey?: string;
  canDive?: boolean;
  canShoot?: boolean;
  speed?: number;
  baseScore?: number;
  projectileCooldownMs?: number;
  diveCooldownMs?: number;
}

export interface EnemyCatalogV1 {
  entries: EnemyCatalogEntryV1[];
}

export interface AmmoCatalogEntryV1 {
  ammoId: string;
  spriteKey: string;
  fireSfxKey?: string;
  impactFxKey?: string;
  damage?: number;
  projectileSpeed: number;
  fireCooldownMs: number;
}

export interface AmmoCatalogV1 {
  entries: AmmoCatalogEntryV1[];
}

export interface FormationLayoutEntryV1 {
  layoutId: string;
  rows: number;
  columns: number;
  spacing: {
    x: number;
    y: number;
  };
  offset?: {
    x: number;
    y: number;
  };
  compact?: boolean;
}

export interface FormationLayoutsV1 {
  entries: FormationLayoutEntryV1[];
}

export interface ScoreEnemyBaseV1 {
  enemyId: string;
  score: number;
}

export interface ScoreComboTierV1 {
  minCount: number;
  multiplier: number;
  name: string;
  tierBonus?: number;
}

export interface ScoreAccuracyThresholdV1 {
  bonus: number;
  minAccuracy: number;
}

export interface ScoreConfigV1 {
  baseEnemyScores: ScoreEnemyBaseV1[];
  combo: {
    enabled: boolean;
    tiers: ScoreComboTierV1[];
    minWindowMs: number;
    resetOnPlayerHit: boolean;
    windowMs: number;
    windowDecayPerLevelMs?: number;
  };
  levelScoreMultiplier: {
    base: number;
    max: number;
    perLevel: number;
  };
  survivalBonus?: {
    bonus?: number;
    perSeconds?: number;
  };
  waveClearBonus: {
    base: number;
    perLifeBonus: number;
  };
  accuracyBonus?: {
    scaleByLevelMultiplier?: boolean;
    thresholds: ScoreAccuracyThresholdV1[];
  };
}

export interface ResolvedGameConfigV1 {
  configHash: string;
  gameConfig: GameConfigV1;
  levelConfigs: ResolvedLevelConfigV1[];
  heroCatalog: HeroCatalogV1;
  enemyCatalog: EnemyCatalogV1;
  ammoCatalog: AmmoCatalogV1;
  formationLayouts: FormationLayoutsV1;
  scoreConfig: ScoreConfigV1;
  versionHash?: string;
  versionId?: string;
  publishedAt?: string;
}
