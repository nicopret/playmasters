import type { ResolvedGameConfigV1 } from '@playmasters/types';
import type { RunContext } from '../runtime';
import { RunState } from '../run';
import { LevelSystem } from './LevelSystem';

const createResolvedConfig = (): ResolvedGameConfigV1 => ({
  configHash: 'hash',
  gameConfig: {
    defaultLives: 3,
    timing: { comboWindowMs: 600 },
  },
  levelConfigs: [
    {
      layoutId: 'layout-a',
      speed: 30,
      waves: [
        { enemyId: 'enemy-a', count: 3 },
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
    baseEnemyScores: [],
    combo: {
      enabled: false,
      minWindowMs: 0,
      resetOnPlayerHit: false,
      tiers: [],
      windowMs: 0,
    },
    levelScoreMultiplier: { base: 1, max: 1, perLevel: 0 },
    waveClearBonus: { base: 0, perLifeBonus: 0 },
  },
});

describe('LevelSystem', () => {
  const createContext = (): RunContext => {
    const resolvedConfig = createResolvedConfig();
    return {
      sdk: {} as never,
      resolvedConfig,
      configHash: resolvedConfig.configHash,
      mountedAt: '2026-02-14T00:00:00.000Z',
      hasPendingUpdate: false,
    };
  };

  it('loads wave 0 on PLAYING', () => {
    const spawnCalls: string[] = [];
    const runStateMachine = {
      requestWaveClear: jest.fn(),
      requestEndRun: jest.fn(),
    };
    const levelSystem = new LevelSystem({
      ctx: createContext(),
      runStateMachine,
      formationSystem: {
        spawnFormation: (wave) => spawnCalls.push(wave.enemyId),
      },
      getActiveEnemyCount: () => 3,
    });

    levelSystem.startLevel(0);
    levelSystem.onEnterRunState(RunState.PLAYING, RunState.COUNTDOWN);
    expect(spawnCalls).toEqual(['enemy-a']);
  });

  it('triggers WAVE_CLEAR when enemy count reaches zero', () => {
    const runStateMachine = {
      requestWaveClear: jest.fn(),
      requestEndRun: jest.fn(),
    };
    const levelSystem = new LevelSystem({
      ctx: createContext(),
      runStateMachine,
      formationSystem: {
        spawnFormation: jest.fn(),
      },
      getActiveEnemyCount: () => 0,
    });

    levelSystem.startLevel(0);
    levelSystem.update(16);
    levelSystem.update(16);
    expect(runStateMachine.requestWaveClear).toHaveBeenCalledTimes(1);
  });

  it('loads next wave config after WAVE_CLEAR -> COUNTDOWN -> PLAYING', () => {
    const spawnCalls: string[] = [];
    const startedWaves: string[] = [];
    const runStateMachine = {
      requestWaveClear: jest.fn(),
      requestEndRun: jest.fn(),
    };
    const levelSystem = new LevelSystem({
      ctx: createContext(),
      runStateMachine,
      formationSystem: {
        spawnFormation: (wave) => spawnCalls.push(wave.enemyId),
      },
      getActiveEnemyCount: () => 2,
      onWaveStarted: ({ wave }) => startedWaves.push(wave.enemyId),
    });

    levelSystem.startLevel(0);
    levelSystem.onEnterRunState(RunState.PLAYING, RunState.COUNTDOWN);
    levelSystem.forceWaveClear('enemies_depleted');
    levelSystem.onEnterRunState(RunState.WAVE_CLEAR, RunState.PLAYING);
    levelSystem.onEnterRunState(RunState.COUNTDOWN, RunState.WAVE_CLEAR);
    levelSystem.onEnterRunState(RunState.PLAYING, RunState.COUNTDOWN);

    expect(spawnCalls).toEqual(['enemy-a', 'enemy-b']);
    expect(startedWaves).toEqual(['enemy-a', 'enemy-b']);
  });

  it('handles forced completion and ends run on final wave clear', () => {
    const runStateMachine = {
      requestWaveClear: jest.fn(),
      requestEndRun: jest.fn(),
    };
    const levelSystem = new LevelSystem({
      ctx: createContext(),
      runStateMachine,
      formationSystem: {
        spawnFormation: jest.fn(),
      },
      getActiveEnemyCount: () => 2,
    });

    levelSystem.startLevel(0);
    levelSystem.forceWaveClear('ENRAGE_TIMEOUT');
    expect(runStateMachine.requestWaveClear).toHaveBeenCalledTimes(1);

    levelSystem.onEnterRunState(RunState.COUNTDOWN, RunState.WAVE_CLEAR);
    levelSystem.onEnterRunState(RunState.PLAYING, RunState.COUNTDOWN);
    levelSystem.forceWaveClear('ENRAGE_TIMEOUT');
    levelSystem.onEnterRunState(RunState.WAVE_CLEAR, RunState.PLAYING);
    expect(runStateMachine.requestEndRun).toHaveBeenCalledWith(
      'all_waves_cleared',
    );
  });
});
