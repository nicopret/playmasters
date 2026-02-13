import type { ResolvedGameConfigV1 } from '../resolved-v1';

export const resolvedConfigExample: ResolvedGameConfigV1 = {
  gameId: 'space-blaster',
  env: 'dev',
  configHash:
    '2ec18e6c8f8b45d84f4de4c66a5e56bd28f2d78d4a9a2ef327f0a6bb4bc2d9a1',
  versionHash:
    'f5031e179cbf0e3cf5f4f10ec09df7bb918557b65006b8f49d86fbdcf5e75480',
  versionId: 'space-blaster.bundle.v1.2026-02-13.1',
  publishedAt: '2026-02-13T00:00:00.000Z',
  gameConfig: {
    defaultLives: 3,
    timing: {
      comboWindowMs: 600,
    },
  },
  levelConfigs: [
    {
      layoutId: 'layout.grid.4x3',
      boss: false,
      dive: 0.2,
      enemyTypes: ['enemy.grunt', 'enemy.shooter'],
      scoreMultiplier: 1,
      shooting: 0.15,
      speed: 48,
      waves: [
        {
          enemyId: 'enemy.grunt',
          count: 6,
          spawnDelayMs: 100,
        },
        {
          enemyId: 'enemy.shooter',
          count: 2,
          spawnDelayMs: 200,
        },
      ],
    },
    {
      layoutId: 'layout.arrowhead',
      boss: true,
      dive: 0.35,
      enemyTypes: ['enemy.elite'],
      scoreMultiplier: 1.2,
      shooting: 0.2,
      speed: 56,
      waves: [
        {
          enemyId: 'enemy.elite',
          count: 4,
          spawnDelayMs: 120,
        },
      ],
    },
  ],
  heroCatalog: {
    entries: [
      {
        heroId: 'hero.standard',
        spriteKey: 'hero.standard.sprite',
        hurtFlashSpriteKey: 'hero.standard.flash',
        engineTrailFxKey: 'hero.standard.trail',
        fireSfxKey: 'hero.standard.fire',
        hitSfxKey: 'hero.standard.hit',
        defaultAmmoId: 'ammo.laser',
        moveSpeed: 260,
        maxLives: 3,
        hitbox: {
          width: 24,
          height: 18,
        },
      },
    ],
  },
  enemyCatalog: {
    entries: [
      {
        enemyId: 'enemy.grunt',
        hp: 20,
        spriteKey: 'enemy.grunt.sprite',
        fireSfxKey: 'enemy.grunt.fire',
        deathSfxKey: 'enemy.grunt.death',
        explodeFxKey: 'enemy.grunt.explode',
        canDive: true,
        canShoot: false,
        speed: 42,
        baseScore: 80,
      },
      {
        enemyId: 'enemy.shooter',
        hp: 30,
        spriteKey: 'enemy.shooter.sprite',
        fireSfxKey: 'enemy.shooter.fire',
        deathSfxKey: 'enemy.shooter.death',
        canDive: true,
        canShoot: true,
        speed: 40,
        baseScore: 120,
        projectileCooldownMs: 1100,
      },
      {
        enemyId: 'enemy.elite',
        hp: 60,
        spriteKey: 'enemy.elite.sprite',
        fireSfxKey: 'enemy.elite.fire',
        deathSfxKey: 'enemy.elite.death',
        diveTelegraphSfxKey: 'enemy.elite.telegraph',
        explodeFxKey: 'enemy.elite.explode',
        canDive: true,
        canShoot: true,
        speed: 45,
        baseScore: 250,
        projectileCooldownMs: 850,
        diveCooldownMs: 1200,
      },
    ],
  },
  ammoCatalog: {
    entries: [
      {
        ammoId: 'ammo.laser',
        spriteKey: 'ammo.laser.sprite',
        fireSfxKey: 'ammo.laser.fire',
        impactFxKey: 'ammo.laser.impact',
        damage: 10,
        projectileSpeed: 420,
        fireCooldownMs: 160,
      },
    ],
  },
  formationLayouts: {
    entries: [
      {
        layoutId: 'layout.grid.4x3',
        rows: 3,
        columns: 4,
        spacing: {
          x: 56,
          y: 42,
        },
        offset: {
          x: 0,
          y: 0,
        },
        compact: false,
      },
      {
        layoutId: 'layout.arrowhead',
        rows: 3,
        columns: 3,
        spacing: {
          x: 52,
          y: 46,
        },
        offset: {
          x: 12,
          y: -8,
        },
        compact: true,
      },
    ],
  },
  scoreConfig: {
    baseEnemyScores: [
      { enemyId: 'enemy.grunt', score: 80 },
      { enemyId: 'enemy.shooter', score: 120 },
      { enemyId: 'enemy.elite', score: 250 },
    ],
    combo: {
      enabled: true,
      minWindowMs: 350,
      resetOnPlayerHit: true,
      tiers: [
        { minCount: 3, multiplier: 1.1, name: 'chain-1', tierBonus: 20 },
        { minCount: 6, multiplier: 1.25, name: 'chain-2', tierBonus: 75 },
      ],
      windowDecayPerLevelMs: 15,
      windowMs: 650,
    },
    levelScoreMultiplier: {
      base: 1,
      max: 1.5,
      perLevel: 0.08,
    },
    waveClearBonus: {
      base: 100,
      perLifeBonus: 30,
    },
    accuracyBonus: {
      scaleByLevelMultiplier: true,
      thresholds: [
        { minAccuracy: 0.5, bonus: 100 },
        { minAccuracy: 0.75, bonus: 250 },
        { minAccuracy: 0.9, bonus: 500 },
      ],
    },
    survivalBonus: {
      bonus: 200,
      perSeconds: 30,
    },
  },
};
