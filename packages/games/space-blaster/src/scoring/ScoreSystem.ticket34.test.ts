import type { ResolvedGameConfigV1 } from '@playmasters/types';
import type { RunContext } from '../runtime';
import { RunEventBus } from '../run';
import { ScoreSystem } from './ScoreSystem';

const createResolvedConfig = (): ResolvedGameConfigV1 => ({
  configHash: 'ticket-34',
  gameConfig: {
    defaultLives: 3,
    timing: { comboWindowMs: 600 },
  },
  levelConfigs: [
    {
      layoutId: 'layout-a',
      speed: 30,
      waves: [{ enemyId: 'enemy-a', count: 3 }],
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
      { enemyId: 'enemy-a', hp: 1, spriteKey: 'enemy-a', baseScore: 95 },
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
    baseEnemyScores: [{ enemyId: 'enemy-a', score: 100 }],
    combo: {
      enabled: true,
      minWindowMs: 0,
      resetOnPlayerHit: false,
      tiers: [{ minCount: 1, multiplier: 1, name: 'base' }],
      windowMs: 1000,
    },
    levelScoreMultiplier: { base: 1, max: 2, perLevel: 0.5 },
    waveClearBonus: { base: 0, perLifeBonus: 0 },
  },
});

const createContext = (
  mutator?: (config: ResolvedGameConfigV1) => void,
): RunContext => {
  const resolvedConfig = createResolvedConfig();
  mutator?.(resolvedConfig);
  return {
    sdk: {} as never,
    resolvedConfig,
    configHash: resolvedConfig.configHash,
    mountedAt: '2026-02-15T00:00:00.000Z',
    hasPendingUpdate: false,
  };
};

describe('ScoreSystem ticket #34 acceptance', () => {
  it('A: computes kill points from baseScore * clamped levelMultiplier', () => {
    const system = new ScoreSystem({
      ctx: createContext(),
      bus: new RunEventBus(),
      getLevelNumber: () => 5, // raw multiplier 3.0 -> clamped to max 2.0
    });

    system.onEnemyKilled('enemy-a', 0);
    const state = system.getState();

    expect(state.breakdownTotals.killPoints).toBe(200);
    expect(state.score).toBe(200);
  });

  it('B: refreshes combo timer on qualifying kills and breaks on expiry', () => {
    const system = new ScoreSystem({
      ctx: createContext(),
      bus: new RunEventBus(),
      getLevelNumber: () => 1,
    });

    system.onEnemyKilled('enemy-a', 0);
    const firstExpiry = system.getState().comboExpiresAtMs;
    expect(system.getState().comboCount).toBe(1);
    expect(firstExpiry).toBe(1000);

    system.onEnemyKilled('enemy-a', 900);
    expect(system.getState().comboCount).toBe(2);
    expect(system.getState().comboExpiresAtMs).toBe(1900);

    system.onEnemyKilled('enemy-a', 1901);
    expect(system.getState().comboCount).toBe(1);
  });

  it('C: awards tier bonus once when entering each tier', () => {
    const system = new ScoreSystem({
      ctx: createContext((config) => {
        config.scoreConfig.combo.tiers = [
          { minCount: 2, multiplier: 1, tierBonus: 50, name: 'tier-1' },
          { minCount: 4, multiplier: 2, tierBonus: 100, name: 'tier-2' },
        ];
      }),
      bus: new RunEventBus(),
      getLevelNumber: () => 1,
    });

    system.onEnemyKilled('enemy-a', 0); // combo 1
    system.onEnemyKilled('enemy-a', 100); // combo 2 enters tier-1
    system.onEnemyKilled('enemy-a', 200); // combo 3 still tier-1
    system.onEnemyKilled('enemy-a', 300); // combo 4 enters tier-2
    system.onEnemyKilled('enemy-a', 400); // combo 5 still tier-2

    expect(system.getState().breakdownTotals.tierBonuses).toBe(150);
  });
});
