import { RunState } from '..';
import { makeRunHarness } from './harness/RunHarness';

describe('run lifecycle integration (ticket #48)', () => {
  it('1) Start -> COUNTDOWN -> PLAYING transitions succeed', async () => {
    const h = makeRunHarness({ submissionBehavior: 'resolve' });

    h.bootToReady();
    expect(h.runStateMachine.state).toBe(RunState.READY);

    h.runStateMachine.requestStart();
    h.tick(0);
    expect(h.runStateMachine.state).toBe(RunState.COUNTDOWN);

    h.tick(99);
    expect(h.runStateMachine.state).toBe(RunState.COUNTDOWN);

    h.tick(1);
    expect(h.runStateMachine.state).toBe(RunState.PLAYING);

    await h.flushAsync();
    expect(h.ctx.runId).toBe('run-test-auth');
    expect(h.transitions.map((t) => `${t.from}->${t.to}`)).toEqual([
      'BOOT->READY',
      'READY->COUNTDOWN',
      'COUNTDOWN->PLAYING',
    ]);
  });

  it('2) wave clear triggers WAVE_CLEAR and advances to the next wave correctly', () => {
    const h = makeRunHarness({ submissionBehavior: 'resolve' });
    h.bootToReady();
    h.startRun();
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
    h.tick(60);
    expect(h.runStateMachine.state).toBe(RunState.COUNTDOWN);
    expect(h.levelSystem.getWaveIndex()).toBe(1);

    h.tick(100);
    expect(h.runStateMachine.state).toBe(RunState.PLAYING);
    expect(h.spawnedEnemyIds).toEqual(['enemy-a', 'enemy-b']);
    expect(h.startedWaves).toEqual([
      { levelIndex: 0, waveIndex: 0 },
      { levelIndex: 0, waveIndex: 1 },
    ]);
  });

  it('3) RESULTS state is reachable reliably even when submit does not resolve', async () => {
    const h = makeRunHarness({ submissionBehavior: 'never' });
    h.bootToReady();
    h.startRun();
    await h.flushAsync();

    h.runStateMachine.requestEndRun('game_over');
    h.tick(0);
    expect(h.runStateMachine.state).toBe(RunState.RUN_ENDING);

    h.tick(50);
    expect(h.runStateMachine.state).toBe(RunState.SUBMITTING);
    expect(h.ctx.submissionStatus?.state).toBe('submitting');

    h.tick(120);
    expect(h.runStateMachine.state).toBe(RunState.RESULTS);
    expect(h.ctx.submissionStatus?.state).toBe('submitting');
    expect(h.getSimNowMs()).toBe(100);
  });
});
