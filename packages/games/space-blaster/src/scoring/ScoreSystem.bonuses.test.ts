import type { ResolvedGameConfigV1 } from '@playmasters/types';
import type { RunContext } from '../runtime';
import { RunEventBus } from '../run';
import { ScoreSystem } from './ScoreSystem';

const makeResolvedConfig = (
  mutator?: (config: ResolvedGameConfigV1) => void,
): ResolvedGameConfigV1 => {
  const config: ResolvedGameConfigV1 = {
    configHash: 'ticket-189',
    gameConfig: {
      defaultLives: 3,
      timing: { comboWindowMs: 600 },
    },
    levelConfigs: [
      {
        layoutId: 'layout-a',
        speed: 30,
        waves: [{ enemyId: 'grunt', count: 3 }],
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
      entries: [{ enemyId: 'grunt', hp: 1, spriteKey: 'grunt', baseScore: 10 }],
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
      baseEnemyScores: [{ enemyId: 'grunt', score: 10 }],
      combo: {
        enabled: true,
        minWindowMs: 0,
        resetOnPlayerHit: false,
        // Keep combo neutral for bonus-focused tests.
        tiers: [{ minCount: 1, multiplier: 1, tierBonus: 0, name: 'base' }],
        windowMs: 1000,
      },
      levelScoreMultiplier: { base: 1, perLevel: 0.5, max: 2 },
      waveClearBonus: { base: 100, perLifeBonus: 25 },
      accuracyBonus: {
        scaleByLevelMultiplier: false,
        thresholds: [
          { minAccuracy: 0.5, bonus: 100 },
          { minAccuracy: 0.8, bonus: 300 },
        ],
      },
    },
  };
  mutator?.(config);
  return config;
};

const createScoreSystem = (args?: {
  mutator?: (config: ResolvedGameConfigV1) => void;
  getLevelNumber?: () => number;
}): ScoreSystem => {
  const resolvedConfig = makeResolvedConfig(args?.mutator);
  const ctx: RunContext = {
    sdk: {} as never,
    resolvedConfig,
    configHash: resolvedConfig.configHash,
    mountedAt: '2026-02-16T00:00:00.000Z',
    hasPendingUpdate: false,
  };
  return new ScoreSystem({
    ctx,
    bus: new RunEventBus(),
    getLevelNumber: args?.getLevelNumber ?? (() => 1),
  });
};

describe('ScoreSystem bonus and clamp behavior (ticket #189)', () => {
  it('1A) clamps level multiplier to max when computing kill points', () => {
    const system = createScoreSystem({
      getLevelNumber: () => 5, // raw: 1 + 0.5*(5-1)=3 -> clamped to 2
    });

    system.onEnemyKilled('grunt', 100);

    expect(system.getState().breakdownTotals.killPoints).toBe(20); // 10 * 2
    expect(system.getState().score).toBe(20);
  });

  it('1B) uses unclamped multiplier when below max', () => {
    const system = createScoreSystem({
      getLevelNumber: () => 2, // raw: 1 + 0.5*(2-1)=1.5
    });

    system.onEnemyKilled('grunt', 100);

    expect(system.getState().breakdownTotals.killPoints).toBe(15); // 10 * 1.5
    expect(system.getState().score).toBe(15);
  });

  it('2) applies wave bonus exactly once per unique levelNumber+waveIndex', () => {
    const system = createScoreSystem({
      getLevelNumber: () => 1, // multiplier 1.0 for simpler wave math
      mutator: (config) => {
        config.scoreConfig.levelScoreMultiplier = {
          base: 1,
          perLevel: 0,
          max: 1,
        };
      },
    });

    system.onWaveCleared({
      levelNumber: 1,
      waveIndex: 0,
      livesRemaining: 2,
      nowMs: 1000,
    });
    const afterFirst = system.getState().score;
    const waveBonusAfterFirst =
      system.getState().breakdownTotals.waveClearBonuses;

    // Same key should be ignored.
    system.onWaveCleared({
      levelNumber: 1,
      waveIndex: 0,
      livesRemaining: 2,
      nowMs: 1001,
    });

    expect(system.getState().score).toBe(afterFirst);
    expect(system.getState().breakdownTotals.waveClearBonuses).toBe(
      waveBonusAfterFirst,
    );
    expect(waveBonusAfterFirst).toBe(150); // base 100 + perLife 25*2

    // Different wave index should apply again.
    system.onWaveCleared({
      levelNumber: 1,
      waveIndex: 1,
      livesRemaining: 2,
      nowMs: 1002,
    });
    expect(system.getState().breakdownTotals.waveClearBonuses).toBe(300);
    expect(system.getState().score).toBe(300);
  });

  it('3A) accuracy bonus uses 0 for edge case shotsFired=0', () => {
    const system = createScoreSystem();

    system.finalizeRun(2000);

    expect(system.getState().breakdownTotals.accuracyBonus).toBe(0);
    expect(system.getState().score).toBe(0);
  });

  it('3B) accuracy bonus selects first threshold when exactly met', () => {
    const system = createScoreSystem();

    for (let i = 0; i < 10; i += 1) {
      system.onShotFired(i);
    }
    for (let i = 0; i < 5; i += 1) {
      system.onShotHit();
    }
    system.finalizeRun(2000);

    expect(system.getState().breakdownTotals.accuracyBonus).toBe(100);
    expect(system.getState().score).toBe(100);
  });

  it('3C) accuracy bonus selects highest threshold met and finalizeRun is idempotent', () => {
    const system = createScoreSystem();

    for (let i = 0; i < 10; i += 1) {
      system.onShotFired(i);
    }
    for (let i = 0; i < 9; i += 1) {
      system.onShotHit();
    }

    system.finalizeRun(2000);
    const firstScore = system.getState().score;
    expect(system.getState().breakdownTotals.accuracyBonus).toBe(300);
    expect(firstScore).toBe(300);

    system.finalizeRun(3000);
    expect(system.getState().breakdownTotals.accuracyBonus).toBe(300);
    expect(system.getState().score).toBe(firstScore);
  });
});
