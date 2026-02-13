import type { ResolvedGameConfigV1 } from '../resolved-v1';

export const resolvedConfigExampleV1: ResolvedGameConfigV1 = {
  configHash:
    '9d223f4d460ec8de0d5ecdf4dbcbf6b0f19ab95f2df4f2d7248e0f6742df3533',
  versionHash:
    '9d223f4d460ec8de0d5ecdf4dbcbf6b0f19ab95f2df4f2d7248e0f6742df3533',
  versionId: '9d223f4d460ec8de0d5ecdf4dbcbf6b0f19ab95f2df4f2d7248e0f6742df3533',
  publishedAt: '2026-02-13T00:00:00.000Z',
  gameConfig: {
    defaultLives: 3,
    timing: {
      comboWindowMs: 500,
    },
  },
  levelConfigs: [
    {
      levelId: 'level-1',
      layoutId: 'layout_10x5',
      enemyTypes: ['enemy_grunt', 'enemy_elite'],
      dive: 10,
      shooting: 20,
      speed: 15,
      scoreMultiplier: 1,
      waves: [
        { enemyId: 'enemy_grunt', count: 8, spawnDelayMs: 0 },
        { enemyId: 'enemy_elite', count: 3, spawnDelayMs: 2000 },
      ],
    },
    {
      levelId: 'level-2',
      layoutId: 'layout_12x6',
      enemyTypes: ['enemy_grunt', 'enemy_elite', 'enemy_striker'],
      dive: 18,
      shooting: 28,
      speed: 22,
      scoreMultiplier: 1.2,
      waves: [
        { enemyId: 'enemy_grunt', count: 10, spawnDelayMs: 0 },
        { enemyId: 'enemy_striker', count: 4, spawnDelayMs: 1500 },
      ],
    },
  ],
  heroCatalog: {
    entries: [
      {
        heroId: 'hero_basic',
        spriteKey: 'sprite.hero.basic.v1',
        defaultAmmoId: 'ammo_laser_basic',
        moveSpeed: 6,
        maxLives: 3,
        hitbox: { width: 32, height: 32 },
        fireSfxKey: 'sfx.hero.fire.v1',
        hitSfxKey: 'sfx.hero.hit.v1',
      },
    ],
  },
  enemyCatalog: {
    entries: [
      {
        enemyId: 'enemy_grunt',
        hp: 3,
        spriteKey: 'sprite.enemy.grunt.v1',
        speed: 1,
        baseScore: 100,
        projectileCooldownMs: 1200,
      },
      {
        enemyId: 'enemy_elite',
        hp: 5,
        spriteKey: 'sprite.enemy.elite.v1',
        speed: 1.5,
        baseScore: 200,
        canShoot: true,
      },
      {
        enemyId: 'enemy_striker',
        hp: 4,
        spriteKey: 'sprite.enemy.striker.v1',
        speed: 2,
        baseScore: 150,
        canDive: true,
        canShoot: true,
        diveCooldownMs: 1500,
      },
    ],
  },
  ammoCatalog: {
    entries: [
      {
        ammoId: 'ammo_laser_basic',
        spriteKey: 'sprite.ammo.laser.basic.v1',
        fireSfxKey: 'sfx.ammo.fire.basic.v1',
        projectileSpeed: 600,
        fireCooldownMs: 200,
        damage: 1,
      },
    ],
  },
  formationLayouts: {
    entries: [
      {
        layoutId: 'layout_10x5',
        rows: 5,
        columns: 10,
        spacing: { x: 12, y: 10 },
        offset: { x: 0, y: 0 },
        compact: true,
      },
      {
        layoutId: 'layout_12x6',
        rows: 6,
        columns: 12,
        spacing: { x: 10, y: 9 },
        offset: { x: 0, y: 0 },
        compact: false,
      },
    ],
  },
  scoreConfig: {
    baseEnemyScores: [
      { enemyId: 'enemy_grunt', score: 100 },
      { enemyId: 'enemy_elite', score: 200 },
      { enemyId: 'enemy_striker', score: 150 },
    ],
    combo: {
      enabled: true,
      tiers: [
        { minCount: 2, multiplier: 1.2, name: 'double' },
        { minCount: 4, multiplier: 1.5, name: 'quad' },
      ],
      minWindowMs: 500,
      resetOnPlayerHit: true,
      windowMs: 2000,
    },
    levelScoreMultiplier: { base: 1, max: 5, perLevel: 0.5 },
    waveClearBonus: { base: 50, perLifeBonus: 10 },
    accuracyBonus: {
      scaleByLevelMultiplier: false,
      thresholds: [
        { bonus: 20, minAccuracy: 0.8 },
        { bonus: 40, minAccuracy: 0.9 },
      ],
    },
    survivalBonus: { bonus: 25, perSeconds: 30 },
  },
};
