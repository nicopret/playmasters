import type { ResolvedGameConfigV1 } from '@playmasters/types';
import type { RunContext } from '../runtime';
import { RUN_EVENT, RunEventBus, RunState } from '../run';
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
    {
      layoutId: 'layout-b',
      speed: 42,
      waves: [{ enemyId: 'enemy-c', count: 4 }],
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
      { enemyId: 'enemy-c', hp: 1, spriteKey: 'enemy-c' },
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
      {
        layoutId: 'layout-b',
        rows: 2,
        columns: 2,
        spacing: { x: 24, y: 16 },
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

  const createBus = () => new RunEventBus();

  it('loads wave 0 on PLAYING', () => {
    const spawnCalls: string[] = [];
    const runStateMachine = {
      requestWaveClear: jest.fn(),
      requestLevelComplete: jest.fn(),
      requestEndRun: jest.fn(),
    };
    const levelSystem = new LevelSystem({
      ctx: createContext(),
      bus: createBus(),
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
    const bus = createBus();
    const waveClearedEvents: Array<{
      levelNumber: number;
      waveIndex: number;
      reason: 'ALL_ENEMIES_DEAD' | 'ENRAGE_TIMEOUT';
      timestampMs: number;
    }> = [];
    bus.on(RUN_EVENT.LEVEL_WAVE_CLEARED, (payload) => {
      waveClearedEvents.push(payload);
    });
    const runStateMachine = {
      requestWaveClear: jest.fn(),
      requestLevelComplete: jest.fn(),
      requestEndRun: jest.fn(),
    };
    const levelSystem = new LevelSystem({
      ctx: createContext(),
      bus,
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
    expect(waveClearedEvents).toHaveLength(1);
    expect(waveClearedEvents[0]?.levelNumber).toBe(1);
    expect(waveClearedEvents[0]?.waveIndex).toBe(0);
    expect(waveClearedEvents[0]?.reason).toBe('ALL_ENEMIES_DEAD');
  });

  it('loads next wave config after WAVE_CLEAR -> COUNTDOWN -> PLAYING', () => {
    const spawnCalls: string[] = [];
    const startedWaves: string[] = [];
    const runStateMachine = {
      requestWaveClear: jest.fn(),
      requestLevelComplete: jest.fn(),
      requestEndRun: jest.fn(),
    };
    const levelSystem = new LevelSystem({
      ctx: createContext(),
      bus: createBus(),
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

  it('requests LEVEL_COMPLETE on final wave when another level exists', () => {
    const runStateMachine = {
      requestWaveClear: jest.fn(),
      requestLevelComplete: jest.fn(),
      requestEndRun: jest.fn(),
    };
    const levelSystem = new LevelSystem({
      ctx: createContext(),
      bus: createBus(),
      runStateMachine,
      formationSystem: {
        spawnFormation: jest.fn(),
      },
      getActiveEnemyCount: () => 2,
    });

    levelSystem.startLevel(0);
    levelSystem.onEnterRunState(RunState.PLAYING, RunState.COUNTDOWN);
    levelSystem.forceWaveClear('ENRAGE_TIMEOUT');
    levelSystem.onEnterRunState(RunState.WAVE_CLEAR, RunState.PLAYING);
    levelSystem.onEnterRunState(RunState.COUNTDOWN, RunState.WAVE_CLEAR);
    levelSystem.onEnterRunState(RunState.PLAYING, RunState.COUNTDOWN);
    levelSystem.forceWaveClear('ENRAGE_TIMEOUT');
    expect(runStateMachine.requestLevelComplete).toHaveBeenCalledTimes(1);
  });

  it('advances level number and resets wave index after LEVEL_COMPLETE', () => {
    const spawnCalls: string[] = [];
    const setLevelIndex = jest.fn();
    const runStateMachine = {
      requestWaveClear: jest.fn(),
      requestLevelComplete: jest.fn(),
      requestEndRun: jest.fn(),
    };
    const levelSystem = new LevelSystem({
      ctx: createContext(),
      bus: createBus(),
      runStateMachine,
      formationSystem: {
        setLevelIndex,
        spawnFormation: (wave) => spawnCalls.push(wave.enemyId),
      },
      getActiveEnemyCount: () => 1,
    });

    levelSystem.startLevel(0);
    levelSystem.onEnterRunState(RunState.PLAYING, RunState.COUNTDOWN);
    levelSystem.forceWaveClear('enemies_depleted');
    levelSystem.onEnterRunState(RunState.WAVE_CLEAR, RunState.PLAYING);
    levelSystem.onEnterRunState(RunState.COUNTDOWN, RunState.WAVE_CLEAR);
    levelSystem.onEnterRunState(RunState.PLAYING, RunState.COUNTDOWN);
    levelSystem.forceWaveClear('enemies_depleted');
    levelSystem.onEnterRunState(RunState.LEVEL_COMPLETE, RunState.PLAYING);

    expect(levelSystem.getLevelNumber()).toBe(2);
    expect(levelSystem.getWaveIndex()).toBe(0);

    levelSystem.onEnterRunState(RunState.COUNTDOWN, RunState.LEVEL_COMPLETE);
    levelSystem.onEnterRunState(RunState.PLAYING, RunState.COUNTDOWN);
    expect(spawnCalls).toEqual(['enemy-a', 'enemy-b', 'enemy-c']);
    expect(setLevelIndex.mock.calls.map((call) => call[0])).toEqual([0, 0, 1]);
  });

  it('ends run after final level is cleared', () => {
    const runStateMachine = {
      requestWaveClear: jest.fn(),
      requestLevelComplete: jest.fn(),
      requestEndRun: jest.fn(),
    };
    const levelSystem = new LevelSystem({
      ctx: createContext(),
      bus: createBus(),
      runStateMachine,
      formationSystem: {
        spawnFormation: jest.fn(),
      },
      getActiveEnemyCount: () => 0,
    });

    levelSystem.startLevel(1);
    levelSystem.onEnterRunState(RunState.PLAYING, RunState.COUNTDOWN);
    levelSystem.update(16);
    expect(runStateMachine.requestEndRun).toHaveBeenCalledWith(
      'all_levels_cleared',
    );
  });
});
