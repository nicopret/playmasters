export interface ResolvedGameConfigDomainV1 {
  defaultLives: number;
  timing: {
    comboWindowMs: number;
  };
}

export interface ResolvedLevelWaveV1 {
  enemyId: string;
  count?: number;
  spawnDelayMs?: number;
}

export interface ResolvedLevelConfigV1 {
  layoutId: string;
  boss?: boolean;
  dive?: number;
  attackTickMs?: number;
  diveChancePerTick?: number;
  maxConcurrentDivers?: number;
  diveScheduler?: {
    attackTickMs?: number;
    diveChancePerTick?: number;
    maxConcurrentDivers?: number;
  };
  enemyTypes?: string[];
  fleetSpeedRamp?: {
    maxMultiplier?: number;
    exponent?: number;
    smoothingPerSecond?: number;
    minAliveForRamp?: number;
  };
  lastEnemiesEnrage?: {
    threshold?: number;
    speedMultiplier?: number;
    timeoutMs?: number;
    autoCompleteOnTimeout?: boolean;
  };
  scoreMultiplier?: number;
  shooting?: number;
  speed?: number;
  waves?: ResolvedLevelWaveV1[];
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

export interface ScoreEnemyEntryV1 {
  enemyId: string;
  score: number;
}

export interface ComboTierV1 {
  minCount: number;
  multiplier: number;
  name: string;
  tierBonus?: number;
}

export interface AccuracyThresholdV1 {
  bonus: number;
  minAccuracy: number;
}

export interface ScoreConfigV1 {
  accuracyBonus?: {
    scaleByLevelMultiplier?: boolean;
    thresholds: AccuracyThresholdV1[];
  };
  baseEnemyScores: ScoreEnemyEntryV1[];
  combo: {
    enabled: boolean;
    minWindowMs: number;
    resetOnPlayerHit: boolean;
    tiers: ComboTierV1[];
    windowDecayPerLevelMs?: number;
    windowMs: number;
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
}
