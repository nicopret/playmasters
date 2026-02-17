import type { EmbeddedGameSdk, ResolvedGameConfigV1 } from '@playmasters/types';
import { LevelSystem } from '../../../levels/LevelSystem';
import { ObjectPool } from '../../../perf/ObjectPool';
import {
  buildFinalScoreSummary,
  type FinalScoreSummary,
  ScoreSystem,
} from '../../../scoring';
import {
  attemptRunSubmission,
  isRunStartTransition,
  registerRunIfAuthenticated,
  resetRunRegistration,
  type RunContext,
} from '../../../runtime';
import { buildSubmitScorePayloadV1 } from '../../../submit';
import {
  orchestrateRunFrame,
  RUN_EVENT,
  RunEventBus,
  RunState,
  RunStateMachine,
} from '../..';
import { OverlayStateMachine } from '../../../overlay';
import { OverlayCoordinator } from '../../../runtime/OverlayCoordinator';
import { createMinimalResolvedConfig } from '../fixtures/resolvedConfig.minimal';

const MACHINE_CONFIG = {
  countdownMs: 100,
  respawnDelayMs: 40,
  waveClearMs: 60,
  levelCompleteMs: 80,
  runEndingDelayMs: 50,
  submittingTimeoutMs: 120,
} as const;

export type SubmissionBehavior = 'resolve' | 'reject' | 'never';

type HarnessOptions = {
  submissionBehavior?: SubmissionBehavior;
  authenticated?: boolean;
  initialResolvedConfig?: ResolvedGameConfigV1;
};

type ListenerTracker = {
  total: number;
  byEvent: Map<string, number>;
};

type PoolMetrics = {
  projectile: ReturnType<ObjectPool<{ id: number }>['stats']>;
  explosion: ReturnType<ObjectPool<{ id: number }>['stats']>;
  particleInUse: number;
};

const createFakeSdk = (options: {
  submissionBehavior: SubmissionBehavior;
  authenticated: boolean;
}): EmbeddedGameSdk =>
  ({
    isAuthenticated: options.authenticated,
    startRun: jest.fn(async () => ({
      run: {
        runId: `run-test-${options.authenticated ? 'auth' : 'guest'}`,
        startedAt: '2026-02-16T00:00:00.000Z',
      },
      sessionToken: 'session-test',
    })),
    submitScore: jest.fn(async () => {
      if (options.submissionBehavior === 'resolve') {
        return { rank: 10, personalBest: false };
      }
      if (options.submissionBehavior === 'reject') {
        throw new Error('submit_failed_for_test');
      }
      return new Promise<never>(() => undefined);
    }),
  }) as unknown as EmbeddedGameSdk;

const createInstrumentedBus = (): {
  bus: RunEventBus;
  getListenerTracker: () => ListenerTracker;
} => {
  const bus = new RunEventBus();
  const rawOn = bus.on.bind(bus);
  const listenerTracker: ListenerTracker = {
    total: 0,
    byEvent: new Map<string, number>(),
  };

  (bus.on as RunEventBus['on']) = ((event, listener) => {
    listenerTracker.total += 1;
    listenerTracker.byEvent.set(
      event,
      (listenerTracker.byEvent.get(event) ?? 0) + 1,
    );
    const unsubscribeRaw = rawOn(event, listener as never);
    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      listenerTracker.total = Math.max(0, listenerTracker.total - 1);
      const prior = listenerTracker.byEvent.get(event) ?? 0;
      if (prior <= 1) {
        listenerTracker.byEvent.delete(event);
      } else {
        listenerTracker.byEvent.set(event, prior - 1);
      }
      unsubscribeRaw();
    };
  }) as RunEventBus['on'];

  return {
    bus,
    getListenerTracker: () => ({
      total: listenerTracker.total,
      byEvent: new Map(listenerTracker.byEvent),
    }),
  };
};

export const makeRunHarness = (options?: HarnessOptions) => {
  const resolvedConfig =
    options?.initialResolvedConfig ?? createMinimalResolvedConfig();
  const sdk = createFakeSdk({
    submissionBehavior: options?.submissionBehavior ?? 'resolve',
    authenticated: options?.authenticated ?? true,
  });
  const instrumentedBus = createInstrumentedBus();
  const bus = instrumentedBus.bus;

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
  let overlayBlockingGameplay = false;
  let simNowMs = 0;
  let simAdvanceCount = 0;
  let wavesCleared = 0;
  let maxLevelReached = 1;
  let maxWaveReached = 1;
  let finalSummary: FinalScoreSummary | null = null;
  let runInstance = 0;

  const projectilePool = new ObjectPool<{ id: number }>({
    initial: 4,
    max: 8,
    create: (() => {
      let nextId = 1;
      return () => ({ id: nextId++ });
    })(),
  });
  const explosionPool = new ObjectPool<{ id: number }>({
    initial: 2,
    max: 4,
    create: (() => {
      let nextId = 1;
      return () => ({ id: nextId++ });
    })(),
  });
  let particleInUse = 0;

  let ctx: RunContext;
  let runStateMachine: RunStateMachine;
  let levelSystem: LevelSystem;
  let scoreSystem: ScoreSystem;
  const overlayStateMachine = new OverlayStateMachine();
  const overlayCoordinator = new OverlayCoordinator({
    overlay: overlayStateMachine,
    onOverlayChanged: (_state, blocksGameplay) => {
      overlayBlockingGameplay = blocksGameplay;
    },
    onRestartRequested: () => {
      if (runStateMachine.state === RunState.RESULTS) {
        runStateMachine.requestStart();
      }
    },
  });

  const createCtx = (): RunContext => ({
    sdk,
    resolvedConfig,
    configHash: resolvedConfig.configHash,
    versionHash: resolvedConfig.versionHash,
    mountedAt: `2026-02-16T00:00:00.${String(runInstance).padStart(3, '0')}Z`,
    runRegistrationStarted: false,
    submissionAttempted: false,
    submissionStatus: { state: 'idle' },
    hasPendingUpdate: false,
  });

  const wireRunSystems = (): void => {
    ctx = createCtx();
    runStateMachine = new RunStateMachine(
      bus,
      { ...MACHINE_CONFIG },
      {
        onEnterState: (state, from) => {
          overlayCoordinator.syncFromRunState(state);
          levelSystem.onEnterRunState(state, from);

          if (
            state === RunState.COUNTDOWN &&
            (from === RunState.READY || from === RunState.RESULTS)
          ) {
            resetRunRegistration(ctx);
            scoreSystem.resetForNewRun();
            simNowMs = 0;
            simAdvanceCount = 0;
            wavesCleared = 0;
            maxLevelReached = 1;
            maxWaveReached = 1;
            finalSummary = null;
            projectilePool.resetAll();
            explosionPool.resetAll();
            particleInUse = 0;
          }

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

    levelSystem = new LevelSystem({
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

    scoreSystem = new ScoreSystem({
      ctx,
      bus,
      getLevelNumber: () => levelSystem.getLevelNumber(),
    });
  };

  wireRunSystems();

  const stateChangedUnsub = bus.on(
    RUN_EVENT.STATE_CHANGED,
    ({ from, to, reason }) => {
      transitions.push({ from, to, reason });
    },
  );
  const waveClearedUnsub = bus.on(RUN_EVENT.LEVEL_WAVE_CLEARED, (payload) => {
    waveClearedEvents.push(payload);
    wavesCleared += 1;
  });

  const tick = (dtMs: number): void => {
    orchestrateRunFrame({
      deltaMs: dtMs,
      overlayBlockingGameplay,
      getState: () => runStateMachine.state,
      advanceRunStateMachine: (runDtMs) => runStateMachine.update(runDtMs),
      setPhysicsPaused: () => undefined,
      advanceSimulation: (simDtMs) => {
        simNowMs += simDtMs;
        simAdvanceCount += 1;
        levelSystem.update(simDtMs);
      },
    });
  };

  const resetPerRunState = (): void => {
    simNowMs = 0;
    simAdvanceCount = 0;
    overlayCoordinator.syncFromRunState(RunState.READY);
    activeEnemyCount = 1;
    wavesCleared = 0;
    maxLevelReached = 1;
    maxWaveReached = 1;
    finalSummary = null;
    transitions.length = 0;
    waveClearedEvents.length = 0;
    startedWaves.length = 0;
    spawnedEnemyIds.length = 0;
  };

  const getPoolMetrics = (): PoolMetrics => ({
    projectile: projectilePool.stats(),
    explosion: explosionPool.stats(),
    particleInUse,
  });

  const capturePoolBaseline = (): PoolMetrics => getPoolMetrics();
  const baseline = capturePoolBaseline();

  return {
    bus,
    get ctx() {
      return ctx;
    },
    sdk,
    get runStateMachine() {
      return runStateMachine;
    },
    get levelSystem() {
      return levelSystem;
    },
    get scoreSystem() {
      return scoreSystem;
    },
    transitions,
    waveClearedEvents,
    startedWaves,
    spawnedEnemyIds,
    tick,
    setActiveEnemyCount: (count: number) => {
      activeEnemyCount = count;
    },
    getSimNowMs: () => simNowMs,
    getSimAdvanceCount: () => simAdvanceCount,
    pause: () => {
      overlayCoordinator.requestPause();
    },
    resume: () => {
      overlayCoordinator.requestResume();
    },
    openSettings: () => {
      overlayCoordinator.requestOpenSettings();
    },
    closeSettings: () => {
      overlayCoordinator.requestCloseSettings();
    },
    bootToReady: () => {
      runStateMachine.requestBootComplete();
      tick(0);
    },
    startRun: () => {
      runStateMachine.requestStart();
      tick(0);
      tick(MACHINE_CONFIG.countdownMs);
    },
    triggerWaveClearByEnemyDepletion: () => {
      activeEnemyCount = 0;
      tick(1);
      tick(0);
    },
    endRunGameOver: () => {
      runStateMachine.requestEndRun('game_over');
      tick(0);
    },
    flushAsync: async () => {
      await Promise.resolve();
      await Promise.resolve();
    },
    spawnPoolActivity: () => {
      projectilePool.acquire();
      projectilePool.acquire();
      explosionPool.acquire();
      particleInUse += 6;
    },
    resetPools: () => {
      projectilePool.resetAll();
      explosionPool.resetAll();
      particleInUse = 0;
    },
    getPoolMetrics,
    getPoolBaseline: () => baseline,
    getListenerTracker: instrumentedBus.getListenerTracker,
    restartRun: () => {
      scoreSystem.dispose();
      runStateMachine.dispose();
      runInstance += 1;
      resetPerRunState();
      projectilePool.resetAll();
      explosionPool.resetAll();
      particleInUse = 0;
      wireRunSystems();
      overlayCoordinator.syncFromRunState(RunState.READY);
    },
    restartFromOverlay: () => {
      overlayCoordinator.requestRestart();
    },
    dispose: () => {
      stateChangedUnsub();
      waveClearedUnsub();
      scoreSystem.dispose();
      runStateMachine.dispose();
    },
  };
};
