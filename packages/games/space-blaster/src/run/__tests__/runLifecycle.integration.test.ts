import type { EmbeddedGameSdk } from '@playmasters/types';
import type { FinalScoreSummary } from '../../scoring';
import { buildFinalScoreSummary, ScoreSystem } from '../../scoring';
import { LevelSystem } from '../../levels/LevelSystem';
import {
  attemptRunSubmission,
  isRunStartTransition,
  registerRunIfAuthenticated,
  type RunContext,
} from '../../runtime';
import { buildSubmitScorePayloadV1 } from '../../submit';
import { RUN_EVENT, RunEventBus, RunState, RunStateMachine } from '..';
import { createMinimalResolvedConfig } from './fixtures/resolvedConfig.minimal';

const MACHINE_CONFIG = {
  countdownMs: 100,
  respawnDelayMs: 40,
  waveClearMs: 60,
  levelCompleteMs: 80,
  runEndingDelayMs: 50,
  submittingTimeoutMs: 120,
} as const;

type SubmissionBehavior = 'resolve' | 'reject' | 'never';

const createFakeSdk = (
  submissionBehavior: SubmissionBehavior,
): EmbeddedGameSdk =>
  ({
    isAuthenticated: true,
    startRun: jest.fn(async () => ({
      run: { runId: 'run-test-123', startedAt: '2026-02-16T00:00:00.000Z' },
      sessionToken: 'session-test',
    })),
    submitScore: jest.fn(async () => {
      if (submissionBehavior === 'resolve') {
        return { rank: 10, personalBest: false };
      }
      if (submissionBehavior === 'reject') {
        throw new Error('submit_failed_for_test');
      }
      return new Promise<never>(() => undefined);
    }),
  }) as unknown as EmbeddedGameSdk;

const makeRunHarness = (submissionBehavior: SubmissionBehavior = 'resolve') => {
  const resolvedConfig = createMinimalResolvedConfig();
  const sdk = createFakeSdk(submissionBehavior);
  const bus = new RunEventBus();
  const transitions: Array<{ from: RunState; to: RunState; reason: string }> =
    [];
  const waveClearedEvents: Array<{
    levelNumber: number;
    waveIndex: number;
    reason: 'ALL_ENEMIES_DEAD' | 'ENRAGE_TIMEOUT';
    nowMs: number;
    livesRemaining: number;
  }> = [];
  const startedWaves: Array<{ levelIndex: number; waveIndex: number }> = [];
  const spawnedEnemyIds: string[] = [];
  let activeEnemyCount = 1;
  let simNowMs = 0;
  let wavesCleared = 0;
  let maxLevelReached = 1;
  let maxWaveReached = 1;
  let finalSummary: FinalScoreSummary | null = null;

  const ctx: RunContext = {
    sdk,
    resolvedConfig,
    configHash: resolvedConfig.configHash,
    versionHash: resolvedConfig.versionHash,
    mountedAt: '2026-02-16T00:00:00.000Z',
    runRegistrationStarted: false,
    submissionAttempted: false,
    submissionStatus: { state: 'idle' },
    hasPendingUpdate: false,
  };

  const runStateMachine = new RunStateMachine(
    bus,
    {
      countdownMs: MACHINE_CONFIG.countdownMs,
      respawnDelayMs: MACHINE_CONFIG.respawnDelayMs,
      waveClearMs: MACHINE_CONFIG.waveClearMs,
      levelCompleteMs: MACHINE_CONFIG.levelCompleteMs,
      runEndingDelayMs: MACHINE_CONFIG.runEndingDelayMs,
      submittingTimeoutMs: MACHINE_CONFIG.submittingTimeoutMs,
    },
    {
      onEnterState: (state, from) => {
        levelSystem.onEnterRunState(state, from);

        if (isRunStartTransition(from, state)) {
          void registerRunIfAuthenticated(ctx);
        }

        if (state === RunState.RUN_ENDING) {
          scoreSystem.finalizeRun(simNowMs);
          finalSummary = buildFinalScoreSummary({
            scoreState: scoreSystem.getState(),
            durationMs: simNowMs,
            levelReached: maxLevelReached,
            waveReached: maxWaveReached,
            wavesCleared,
          });
        }

        if (state === RunState.SUBMITTING) {
          const summary =
            finalSummary ??
            buildFinalScoreSummary({
              scoreState: scoreSystem.getState(),
              durationMs: simNowMs,
              levelReached: maxLevelReached,
              waveReached: maxWaveReached,
              wavesCleared,
            });
          const payload = buildSubmitScorePayloadV1({
            finalScore: summary,
            run: ctx,
            levelProgress: {
              levelNumber: maxLevelReached,
              waveIndex: Math.max(0, maxWaveReached - 1),
              wavesCleared,
            },
          });

          void (async () => {
            await attemptRunSubmission({
              ctx,
              payload,
              nowMs: simNowMs,
            });
            runStateMachine.requestSubmissionComplete();
          })();
        }
      },
    },
  );

  const levelSystem = new LevelSystem({
    ctx,
    bus,
    runStateMachine,
    formationSystem: {
      setLevelIndex: () => undefined,
      spawnFormation: (wave) => {
        spawnedEnemyIds.push(wave.enemyId);
      },
    },
    getActiveEnemyCount: () => activeEnemyCount,
    getWaveClearContext: () => ({ nowMs: simNowMs, livesRemaining: 3 }),
    onWaveStarted: ({ levelIndex, waveIndex }) => {
      startedWaves.push({ levelIndex, waveIndex });
      maxLevelReached = Math.max(maxLevelReached, levelIndex + 1);
      maxWaveReached = Math.max(maxWaveReached, waveIndex + 1);
    },
  });

  const scoreSystem = new ScoreSystem({
    ctx,
    bus,
    getLevelNumber: () => levelSystem.getLevelNumber(),
  });

  bus.on(RUN_EVENT.STATE_CHANGED, ({ from, to, reason }) => {
    transitions.push({ from, to, reason });
  });
  bus.on(RUN_EVENT.LEVEL_WAVE_CLEARED, (payload) => {
    waveClearedEvents.push(payload);
    wavesCleared += 1;
  });

  const tick = (dtMs: number): void => {
    runStateMachine.update(dtMs);
    if (runStateMachine.state !== RunState.PLAYING) {
      return;
    }
    simNowMs += dtMs;
    levelSystem.update(dtMs);
  };

  const bootToReady = (): void => {
    runStateMachine.requestBootComplete();
    tick(0);
  };

  const startToPlaying = (): void => {
    runStateMachine.requestStart();
    tick(0);
    tick(MACHINE_CONFIG.countdownMs);
  };

  const flushAsync = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
  };

  return {
    bus,
    ctx,
    sdk,
    runStateMachine,
    levelSystem,
    scoreSystem,
    transitions,
    waveClearedEvents,
    startedWaves,
    spawnedEnemyIds,
    setActiveEnemyCount: (count: number) => {
      activeEnemyCount = count;
    },
    getSimNowMs: () => simNowMs,
    tick,
    bootToReady,
    startToPlaying,
    flushAsync,
  };
};

describe('run lifecycle integration (ticket #48)', () => {
  it('1) Start -> COUNTDOWN -> PLAYING transitions succeed', async () => {
    const h = makeRunHarness('resolve');

    h.bootToReady();
    expect(h.runStateMachine.state).toBe(RunState.READY);

    h.runStateMachine.requestStart();
    h.tick(0);
    expect(h.runStateMachine.state).toBe(RunState.COUNTDOWN);

    h.tick(MACHINE_CONFIG.countdownMs - 1);
    expect(h.runStateMachine.state).toBe(RunState.COUNTDOWN);

    h.tick(1);
    expect(h.runStateMachine.state).toBe(RunState.PLAYING);

    await h.flushAsync();
    expect(h.ctx.runId).toBe('run-test-123');
    expect(h.transitions.map((t) => `${t.from}->${t.to}`)).toEqual([
      'BOOT->READY',
      'READY->COUNTDOWN',
      'COUNTDOWN->PLAYING',
    ]);
  });

  it('2) wave clear triggers WAVE_CLEAR and advances to the next wave correctly', () => {
    const h = makeRunHarness('resolve');
    h.bootToReady();
    h.startToPlaying();
    expect(h.runStateMachine.state).toBe(RunState.PLAYING);
    expect(h.levelSystem.getWaveIndex()).toBe(0);
    expect(h.spawnedEnemyIds).toEqual(['enemy-a']);

    h.setActiveEnemyCount(0);
    h.tick(16);

    expect(h.waveClearedEvents).toHaveLength(1);
    expect(h.waveClearedEvents[0]).toMatchObject({
      levelNumber: 1,
      waveIndex: 0,
      reason: 'ALL_ENEMIES_DEAD',
    });
    expect(h.runStateMachine.state).toBe(RunState.PLAYING);

    h.tick(0);
    expect(h.runStateMachine.state).toBe(RunState.WAVE_CLEAR);

    h.setActiveEnemyCount(1);
    h.tick(MACHINE_CONFIG.waveClearMs);
    expect(h.runStateMachine.state).toBe(RunState.COUNTDOWN);
    expect(h.levelSystem.getWaveIndex()).toBe(1);

    h.tick(MACHINE_CONFIG.countdownMs);
    expect(h.runStateMachine.state).toBe(RunState.PLAYING);
    expect(h.spawnedEnemyIds).toEqual(['enemy-a', 'enemy-b']);
    expect(h.startedWaves).toEqual([
      { levelIndex: 0, waveIndex: 0 },
      { levelIndex: 0, waveIndex: 1 },
    ]);
  });

  it('3) RESULTS state is reachable reliably even when submit does not resolve', async () => {
    const h = makeRunHarness('never');
    h.bootToReady();
    h.startToPlaying();
    await h.flushAsync();

    h.runStateMachine.requestEndRun('game_over');
    h.tick(0);
    expect(h.runStateMachine.state).toBe(RunState.RUN_ENDING);

    h.tick(MACHINE_CONFIG.runEndingDelayMs);
    expect(h.runStateMachine.state).toBe(RunState.SUBMITTING);
    expect(h.ctx.submissionStatus?.state).toBe('submitting');

    h.tick(MACHINE_CONFIG.submittingTimeoutMs);
    expect(h.runStateMachine.state).toBe(RunState.RESULTS);
    expect(h.ctx.submissionStatus?.state).toBe('submitting');
    expect(h.getSimNowMs()).toBe(MACHINE_CONFIG.countdownMs);
  });
});
