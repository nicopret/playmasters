import type { ResolvedGameConfigV1 } from '@playmasters/types';
import type { RunContext } from '../runtime';
import { RUN_EVENT, RunEventBus } from '../run';
import { ScoreSystem, computeAccuracy } from './ScoreSystem';

const createResolvedConfig = (): ResolvedGameConfigV1 => ({
  configHash: 'ticket-35',
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
    entries: [{ enemyId: 'enemy-a', hp: 1, spriteKey: 'enemy-a', baseScore: 50 }],
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
      enabled: false,
      minWindowMs: 0,
      resetOnPlayerHit: false,
      tiers: [],
      windowMs: 0,
    },
    levelScoreMultiplier: { base: 1.5, max: 1.5, perLevel: 0 },
    waveClearBonus: { base: 100, perLifeBonus: 25 },
    accuracyBonus: {
      scaleByLevelMultiplier: false,
      thresholds: [
        { minAccuracy: 0.5, bonus: 100 },
        { minAccuracy: 0.8, bonus: 300 },
      ],
    },
  },
});

const createContext = (): RunContext => {
  const resolvedConfig = createResolvedConfig();
  return {
    sdk: {} as never,
    resolvedConfig,
    configHash: resolvedConfig.configHash,
    mountedAt: '2026-02-16T00:00:00.000Z',
    hasPendingUpdate: false,
  };
};

describe('ScoreSystem ticket #35 acceptance', () => {
  it('1) applies wave clear bonus base + per-life and only once per wave key', () => {
    const bus = new RunEventBus();
    const system = new ScoreSystem({
      ctx: createContext(),
      bus,
      getLevelNumber: () => 1,
    });

    bus.emit(RUN_EVENT.LEVEL_WAVE_CLEARED, {
      levelNumber: 1,
      waveIndex: 0,
      reason: 'ALL_ENEMIES_DEAD',
      nowMs: 1000,
      livesRemaining: 2,
    });
    bus.emit(RUN_EVENT.LEVEL_WAVE_CLEARED, {
      levelNumber: 1,
      waveIndex: 0,
      reason: 'ALL_ENEMIES_DEAD',
      nowMs: 1001,
      livesRemaining: 2,
    });

    // base=round(100*1.5)=150, perLife=round(25*2*1.5)=75 => total 225 once
    expect(system.getState().breakdownTotals.waveClearBonuses).toBe(225);
    expect(system.getState().score).toBe(225);
  });

  it('2) tracks shotsFired/shotsHit and computes accuracy', () => {
    const bus = new RunEventBus();
    const system = new ScoreSystem({
      ctx: createContext(),
      bus,
      getLevelNumber: () => 1,
    });

    bus.emit(RUN_EVENT.PLAYER_SHOT_FIRED, { nowMs: 1 });
    bus.emit(RUN_EVENT.PLAYER_SHOT_FIRED, { nowMs: 2 });
    bus.emit(RUN_EVENT.PLAYER_SHOT_FIRED, { nowMs: 3 });
    bus.emit(RUN_EVENT.PLAYER_SHOT_HIT, { nowMs: 4 });
    bus.emit(RUN_EVENT.PLAYER_SHOT_HIT, { nowMs: 5 });

    expect(system.getState().shotsFired).toBe(3);
    expect(system.getState().shotsHit).toBe(2);
    expect(computeAccuracy(system.getState().shotsFired, system.getState().shotsHit)).toBeCloseTo(
      2 / 3,
    );
    expect(computeAccuracy(0, 0)).toBe(0);
  });

  it('3) applies highest accuracy threshold met once at finalizeRun (no penalties)', () => {
    const bus = new RunEventBus();
    const system = new ScoreSystem({
      ctx: createContext(),
      bus,
      getLevelNumber: () => 1,
    });

    for (let i = 0; i < 10; i += 1) {
      bus.emit(RUN_EVENT.PLAYER_SHOT_FIRED, { nowMs: i });
    }
    for (let i = 0; i < 8; i += 1) {
      bus.emit(RUN_EVENT.PLAYER_SHOT_HIT, { nowMs: 100 + i });
    }

    system.finalizeRun(2000);
    const onceScore = system.getState().score;
    expect(system.getState().breakdownTotals.accuracyBonus).toBe(300);
    expect(onceScore).toBe(300);

    system.finalizeRun(2001);
    expect(system.getState().score).toBe(onceScore);
    expect(system.getState().breakdownTotals.accuracyBonus).toBe(300);
  });
});
