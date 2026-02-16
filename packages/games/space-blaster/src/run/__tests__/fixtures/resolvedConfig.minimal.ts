import type { ResolvedGameConfigV1 } from '@playmasters/types';

export const createMinimalResolvedConfig = (): ResolvedGameConfigV1 => ({
  configHash: 'f'.repeat(64),
  versionHash: 'e'.repeat(64),
  gameConfig: {
    defaultLives: 3,
    timing: { comboWindowMs: 600 },
  },
  levelConfigs: [
    {
      layoutId: 'layout-a',
      speed: 30,
      waves: [
        { enemyId: 'enemy-a', count: 2 },
        { enemyId: 'enemy-b', count: 2 },
      ],
    },
  ],
  heroCatalog: {
    entries: [
      {
        heroId: 'hero-a',
        spriteKey: 'hero',
        defaultAmmoId: 'ammo-a',
        moveSpeed: 100,
        maxLives: 3,
        hitbox: { width: 10, height: 10 },
      },
    ],
  },
  enemyCatalog: {
    entries: [
      { enemyId: 'enemy-a', hp: 1, spriteKey: 'enemy-a' },
      { enemyId: 'enemy-b', hp: 1, spriteKey: 'enemy-b' },
    ],
  },
  ammoCatalog: {
    entries: [
      {
        ammoId: 'ammo-a',
        spriteKey: 'ammo',
        projectileSpeed: 100,
        fireCooldownMs: 100,
      },
    ],
  },
  formationLayouts: {
    entries: [
      {
        layoutId: 'layout-a',
        rows: 1,
        columns: 3,
        spacing: { x: 20, y: 12 },
      },
    ],
  },
  scoreConfig: {
    baseEnemyScores: [
      { enemyId: 'enemy-a', score: 10 },
      { enemyId: 'enemy-b', score: 10 },
    ],
    combo: {
      enabled: true,
      minWindowMs: 0,
      resetOnPlayerHit: false,
      tiers: [{ minCount: 1, multiplier: 1, tierBonus: 0, name: 'base' }],
      windowMs: 1000,
    },
    levelScoreMultiplier: { base: 1, perLevel: 0, max: 1 },
    waveClearBonus: { base: 0, perLifeBonus: 0 },
    accuracyBonus: {
      scaleByLevelMultiplier: false,
      thresholds: [{ minAccuracy: 1, bonus: 0 }],
    },
  },
});
