import type { ResolvedGameConfigV1 } from '@playmasters/types';
import type { RunContext } from '../runtime';
import { RunEventBus } from '../run';
import { ScoreSystem } from './ScoreSystem';

const createResolvedConfig = (): ResolvedGameConfigV1 => ({
  configHash: 'ticket-188',
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
      resetOnPlayerHit: true,
      tiers: [
        { minCount: 1, multiplier: 1.0, tierBonus: 0, name: 'base' },
        { minCount: 3, multiplier: 2.0, tierBonus: 50, name: 'tier-1' },
        { minCount: 5, multiplier: 3.0, tierBonus: 100, name: 'tier-2' },
      ],
      windowMs: 1000,
    },
    levelScoreMultiplier: { base: 1.0, perLevel: 0, max: 1.0 },
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
    mountedAt: '2026-02-16T00:00:00.000Z',
    hasPendingUpdate: false,
  };
};

const createSystem = (
  mutator?: (config: ResolvedGameConfigV1) => void,
): ScoreSystem =>
  new ScoreSystem({
    ctx: createContext(mutator),
    bus: new RunEventBus(),
    getLevelNumber: () => 1,
  });

const killAt = (system: ScoreSystem, nowMs: number): void => {
  system.onEnemyKilled('grunt', nowMs);
};

describe('ScoreSystem combo tier behavior (ticket #188)', () => {
  it('1) chooses tiers correctly at boundary combo counts', () => {
    const system = createSystem();

    killAt(system, 0); // combo 1 -> tier index 0
    expect(system.getState().comboCount).toBe(1);
    expect(system.getState().currentTierIndex).toBe(0);

    killAt(system, 100); // combo 2 -> still tier index 0
    expect(system.getState().comboCount).toBe(2);
    expect(system.getState().currentTierIndex).toBe(0);

    killAt(system, 200); // combo 3 -> tier index 1 boundary
    expect(system.getState().comboCount).toBe(3);
    expect(system.getState().currentTierIndex).toBe(1);

    killAt(system, 300); // combo 4 -> still tier index 1
    expect(system.getState().comboCount).toBe(4);
    expect(system.getState().currentTierIndex).toBe(1);

    killAt(system, 400); // combo 5 -> tier index 2 boundary
    expect(system.getState().comboCount).toBe(5);
    expect(system.getState().currentTierIndex).toBe(2);
  });

  it('2) awards tier bonus once per tier entry', () => {
    const system = createSystem();

    killAt(system, 0); // combo 1 (base tier)
    killAt(system, 100); // combo 2 (still base)
    killAt(system, 200); // combo 3 enters tier-1 (+50)
    killAt(system, 300); // combo 4 stays tier-1 (+0)
    killAt(system, 400); // combo 5 enters tier-2 (+100)
    killAt(system, 500); // combo 6 stays tier-2 (+0)

    const state = system.getState();
    expect(state.breakdownTotals.tierBonuses).toBe(150);
    const tierEnterEvents = state.eventLog.filter(
      (event) => event.type === 'TIER_ENTER',
    );
    expect(tierEnterEvents).toHaveLength(3); // base tier + tier-1 + tier-2
    expect(state.currentTierIndex).toBe(2);
  });

  it('3) combo reset clears tier state and allows tier bonuses on re-entry', () => {
    const system = createSystem();
    const scores: number[] = [system.getState().score];

    killAt(system, 0);
    killAt(system, 100);
    killAt(system, 200); // combo 3 -> tier-1 entered
    expect(system.getState().currentTierIndex).toBe(1);
    expect(system.getState().breakdownTotals.tierBonuses).toBe(50);
    scores.push(system.getState().score);

    killAt(system, 1201); // expired reset, new combo starts
    expect(system.getState().comboCount).toBe(1);
    expect(system.getState().currentTierIndex).toBe(0);
    expect(system.getState().lastResetReason).toBe('EXPIRED');
    scores.push(system.getState().score);

    system.onPlayerHit(1300); // resetOnPlayerHit=true
    expect(system.getState().comboCount).toBe(0);
    expect(system.getState().currentTierIndex).toBeNull();
    expect(system.getState().lastResetReason).toBe('PLAYER_HIT');
    scores.push(system.getState().score);

    killAt(system, 1400);
    killAt(system, 1500);
    killAt(system, 1600); // tier-1 re-entry grants +50 again
    expect(system.getState().breakdownTotals.tierBonuses).toBe(100);
    scores.push(system.getState().score);

    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }
  });
});
