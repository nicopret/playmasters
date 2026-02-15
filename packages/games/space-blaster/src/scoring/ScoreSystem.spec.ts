import type { ResolvedGameConfigV1 } from '@playmasters/types';
import type { RunContext } from '../runtime';
import { RUN_EVENT, RunEventBus } from '../run';
import {
  computeComboTierIndex,
  computeLevelMultiplier,
  ScoreSystem,
  selectHighestComboTier,
} from './ScoreSystem';

const createResolvedConfig = (
  mutator?: (config: ResolvedGameConfigV1) => void,
): ResolvedGameConfigV1 => {
  const config: ResolvedGameConfigV1 = {
    configHash: 'hash',
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
        { enemyId: 'enemy-b', hp: 1, spriteKey: 'enemy-b', baseScore: 40 },
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
        tiers: [
          { minCount: 3, multiplier: 2, name: 'triple', tierBonus: 100 },
          { minCount: 1, multiplier: 1, name: 'base' },
        ],
        windowMs: 1000,
      },
      levelScoreMultiplier: { base: 1, max: 1.5, perLevel: 0.25 },
      waveClearBonus: { base: 0, perLifeBonus: 0 },
    },
  };
  mutator?.(config);
  return config;
};

describe('ScoreSystem', () => {
  const createContext = (
    mutator?: (config: ResolvedGameConfigV1) => void,
  ): RunContext => {
    const resolvedConfig = createResolvedConfig(mutator);
    return {
      sdk: {} as never,
      resolvedConfig,
      configHash: resolvedConfig.configHash,
      mountedAt: '2026-02-14T00:00:00.000Z',
      hasPendingUpdate: false,
    };
  };

  it('computes level multiplier with level-1 baseline and max clamp', () => {
    expect(
      computeLevelMultiplier({
        levelNumber: 1,
        base: 1,
        perLevel: 0.25,
        max: 2,
      }),
    ).toBe(1);
    expect(
      computeLevelMultiplier({
        levelNumber: 3,
        base: 1,
        perLevel: 0.25,
        max: 2,
      }),
    ).toBe(1.5);
    expect(
      computeLevelMultiplier({
        levelNumber: 50,
        base: 1,
        perLevel: 0.25,
        max: 2,
      }),
    ).toBe(2);
  });

  it('selects highest combo tier reached', () => {
    const tiers = [
      { minCount: 1, multiplier: 1, name: 'base' },
      { minCount: 3, multiplier: 2, name: 'triple' },
      { minCount: 6, multiplier: 3, name: 'insane' },
    ];
    expect(selectHighestComboTier(tiers, 2)?.multiplier).toBe(1);
    expect(selectHighestComboTier(tiers, 3)?.multiplier).toBe(2);
    expect(selectHighestComboTier(tiers, 10)?.multiplier).toBe(3);
  });

  it('computes combo tier index from the highest tier reached', () => {
    const tiers = [
      { minCount: 1, multiplier: 1, name: 'base' },
      { minCount: 2, multiplier: 1.2, name: 'double' },
      { minCount: 4, multiplier: 1.5, name: 'quad' },
    ];
    expect(computeComboTierIndex(tiers, 0)).toBeNull();
    expect(computeComboTierIndex(tiers, 1)).toBe(0);
    expect(computeComboTierIndex(tiers, 3)).toBe(1);
    expect(computeComboTierIndex(tiers, 99)).toBe(2);
  });

  it('awards rounded kill points from baseEnemyScore * levelMultiplier', () => {
    const bus = new RunEventBus();
    const system = new ScoreSystem({
      ctx: createContext(),
      bus,
      getLevelNumber: () => 2,
    });

    // baseEnemyScore=100; levelMultiplier=1.25 -> base points=125
    system.onEnemyKilled('enemy-a', 0);
    const state = system.getState();
    expect(state.breakdownTotals.killPoints).toBe(125);
    expect(state.score).toBe(125);
  });

  it('awards tierBonus once per tier entry', () => {
    const bus = new RunEventBus();
    const system = new ScoreSystem({
      ctx: createContext((config) => {
        config.scoreConfig.combo.tiers = [
          { minCount: 2, multiplier: 1, tierBonus: 50, name: 'tier-1' },
          { minCount: 4, multiplier: 2, tierBonus: 100, name: 'tier-2' },
        ];
      }),
      bus,
      getLevelNumber: () => 1,
    });

    system.onEnemyKilled('enemy-a', 0); // combo 1
    system.onEnemyKilled('enemy-a', 100); // combo 2 enters tier-1
    system.onEnemyKilled('enemy-a', 200); // combo 3 stays tier-1
    system.onEnemyKilled('enemy-a', 300); // combo 4 enters tier-2
    system.onEnemyKilled('enemy-a', 400); // combo 5 stays tier-2

    const state = system.getState();
    expect(state.breakdownTotals.tierBonuses).toBe(150);
    expect(state.currentTierIndex).toBe(1);
    expect(state.lastTierReachedAtCount).toBe(4);
  });

  it('increments combo only for qualifying kills within window', () => {
    const bus = new RunEventBus();
    const system = new ScoreSystem({
      ctx: createContext(),
      bus,
      getLevelNumber: () => 1,
    });

    system.onEnemyKilled('enemy-a', 0);
    expect(system.getState().comboCount).toBe(1);
    system.onEnemyKilled('enemy-a', 999);
    expect(system.getState().comboCount).toBe(2);
    system.onEnemyKilled('enemy-a', 2001);
    expect(system.getState().comboCount).toBe(1);
  });

  it('resets combo chain on expiry before processing kill', () => {
    const bus = new RunEventBus();
    const system = new ScoreSystem({
      ctx: createContext((config) => {
        config.scoreConfig.combo.tiers = [
          { minCount: 2, multiplier: 1, tierBonus: 25, name: 'tier-1' },
        ];
      }),
      bus,
      getLevelNumber: () => 1,
    });

    system.onEnemyKilled('enemy-a', 0);
    system.onEnemyKilled('enemy-a', 100);
    expect(system.getState().currentTierIndex).toBe(0);

    system.onEnemyKilled('enemy-a', 2000);
    const state = system.getState();
    expect(state.comboCount).toBe(1);
    expect(state.currentTierIndex).toBeNull();
    expect(state.lastResetReason).toBe('EXPIRED');
  });

  it('resets combo on player hit when configured and can re-earn tier bonuses', () => {
    const bus = new RunEventBus();
    const system = new ScoreSystem({
      ctx: createContext((config) => {
        config.scoreConfig.combo.resetOnPlayerHit = true;
        config.scoreConfig.combo.tiers = [
          { minCount: 2, multiplier: 1, tierBonus: 10, name: 'tier-1' },
        ];
      }),
      bus,
      getLevelNumber: () => 1,
    });

    system.onEnemyKilled('enemy-a', 0);
    system.onEnemyKilled('enemy-a', 100);
    expect(system.getState().breakdownTotals.tierBonuses).toBe(10);

    system.onPlayerHit(150);
    expect(system.getState().comboCount).toBe(0);
    expect(system.getState().currentTierIndex).toBeNull();
    expect(system.getState().lastResetReason).toBe('PLAYER_HIT');

    system.onEnemyKilled('enemy-a', 200);
    system.onEnemyKilled('enemy-a', 300);
    expect(system.getState().breakdownTotals.tierBonuses).toBe(20);
  });

  it('never decreases score across kills and combo resets', () => {
    const bus = new RunEventBus();
    const system = new ScoreSystem({
      ctx: createContext((config) => {
        config.scoreConfig.combo.resetOnPlayerHit = true;
      }),
      bus,
      getLevelNumber: () => 1,
    });

    const scores: number[] = [system.getState().score];
    system.onEnemyKilled('enemy-a', 0);
    scores.push(system.getState().score);
    system.onEnemyKilled('enemy-a', 50);
    scores.push(system.getState().score);
    system.onPlayerHit(100);
    scores.push(system.getState().score);
    system.onEnemyKilled('enemy-a', 3000);
    scores.push(system.getState().score);

    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }
  });

  it('uses enemy catalog baseScore as fallback when score map is missing enemyId', () => {
    const bus = new RunEventBus();
    const system = new ScoreSystem({
      ctx: createContext(),
      bus,
      getLevelNumber: () => 1,
    });

    system.onEnemyKilled('enemy-b', 0);
    expect(system.getState().breakdownTotals.killPoints).toBe(40);
  });

  it('keeps breakdown totals equal to score for kill/combo/tier points', () => {
    const bus = new RunEventBus();
    const system = new ScoreSystem({
      ctx: createContext((config) => {
        config.scoreConfig.combo.tiers = [
          { minCount: 2, multiplier: 1.5, tierBonus: 25, name: 'tier-1' },
          { minCount: 4, multiplier: 2, tierBonus: 40, name: 'tier-2' },
        ];
      }),
      bus,
      getLevelNumber: () => 2,
    });

    system.onEnemyKilled('enemy-a', 0);
    system.onEnemyKilled('enemy-a', 100);
    system.onEnemyKilled('enemy-a', 200);
    system.onEnemyKilled('enemy-a', 300);

    const state = system.getState();
    const sum =
      state.breakdownTotals.killPoints +
      state.breakdownTotals.comboExtra +
      state.breakdownTotals.tierBonuses +
      state.breakdownTotals.waveBonuses +
      state.breakdownTotals.accuracyBonuses;
    expect(sum).toBe(state.score);
  });

  it('keeps event log bounded to configured max size', () => {
    const bus = new RunEventBus();
    const system = new ScoreSystem({
      ctx: createContext((config) => {
        config.scoreConfig.eventLogSize = 3;
      }),
      bus,
      getLevelNumber: () => 1,
    });

    for (let i = 0; i < 10; i += 1) {
      system.onShotFired(i);
    }

    expect(system.getState().eventLog).toHaveLength(3);
    const shotEvents = system.getState().eventLog;
    expect(shotEvents[0]).toEqual({ type: 'SHOT_FIRED', atMs: 7 });
    expect(shotEvents[1]).toEqual({ type: 'SHOT_FIRED', atMs: 8 });
    expect(shotEvents[2]).toEqual({ type: 'SHOT_FIRED', atMs: 9 });
  });

  it('handles shot, kill, and player-hit events via bus API', () => {
    const bus = new RunEventBus();
    const system = new ScoreSystem({
      ctx: createContext((config) => {
        config.scoreConfig.combo.resetOnPlayerHit = true;
      }),
      bus,
      getLevelNumber: () => 1,
    });

    bus.emit(RUN_EVENT.PLAYER_SHOT_FIRED, { nowMs: 10 });
    bus.emit(RUN_EVENT.ENEMY_KILLED, { enemyId: 'enemy-a', nowMs: 20 });
    bus.emit(RUN_EVENT.PLAYER_HIT, { nowMs: 30 });

    expect(system.getState().shotsFired).toBe(1);
    expect(system.getState().breakdownTotals.kills).toBe(1);
    expect(system.getState().comboCount).toBe(0);
  });
});
