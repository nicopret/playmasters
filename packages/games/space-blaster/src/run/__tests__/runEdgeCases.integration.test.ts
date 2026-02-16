import { RunState } from '..';
import { makeRunHarness } from './harness/RunHarness';

describe('run lifecycle edge cases integration (ticket #184)', () => {
  it('1) pause freezes simulation and resume restores advancement', () => {
    const h = makeRunHarness({ submissionBehavior: 'resolve' });
    h.bootToReady();
    h.startRun();
    expect(h.runStateMachine.state).toBe(RunState.PLAYING);

    h.tick(50);
    const beforePauseNow = h.getSimNowMs();
    const beforePauseAdvanceCount = h.getSimAdvanceCount();
    expect(beforePauseNow).toBe(150);

    h.pause();
    h.tick(1000);
    expect(h.runStateMachine.state).toBe(RunState.PLAYING);
    expect(h.getSimNowMs()).toBe(beforePauseNow);
    expect(h.getSimAdvanceCount()).toBe(beforePauseAdvanceCount);

    h.resume();
    h.tick(25);
    expect(h.getSimNowMs()).toBe(beforePauseNow + 25);
    expect(h.getSimAdvanceCount()).toBe(beforePauseAdvanceCount + 1);
  });

  it('2) restart resets pools/context and listener count remains stable across repeated restarts', () => {
    const h = makeRunHarness({ submissionBehavior: 'resolve' });
    const baselineListenerCount = h.getListenerTracker().total;
    const poolBaseline = h.getPoolBaseline();

    h.bootToReady();
    h.startRun();
    h.spawnPoolActivity();
    const activeBeforeRestart = h.getPoolMetrics();
    expect(activeBeforeRestart.projectile.active).toBeGreaterThan(0);
    expect(activeBeforeRestart.explosion.active).toBeGreaterThan(0);
    expect(activeBeforeRestart.particleInUse).toBeGreaterThan(0);

    let priorCtx = h.ctx;
    for (let idx = 0; idx < 5; idx += 1) {
      h.restartRun();
      const metrics = h.getPoolMetrics();
      expect(metrics).toEqual(poolBaseline);
      expect(h.ctx).not.toBe(priorCtx);
      expect(h.ctx.runId).toBeUndefined();
      expect(h.ctx.submissionAttempted).toBe(false);
      expect(h.ctx.submissionStatus).toEqual({ state: 'idle' });
      expect(h.getListenerTracker().total).toBe(baselineListenerCount);

      h.bootToReady();
      h.startRun();
      expect(h.getListenerTracker().total).toBe(baselineListenerCount);
      priorCtx = h.ctx;
    }
  });

  it('3A) never-resolving submission does not block RESULTS', async () => {
    const h = makeRunHarness({ submissionBehavior: 'never' });
    h.bootToReady();
    h.startRun();
    await h.flushAsync();

    h.endRunGameOver();
    expect(h.runStateMachine.state).toBe(RunState.RUN_ENDING);

    h.tick(50);
    expect(h.runStateMachine.state).toBe(RunState.SUBMITTING);
    expect(h.ctx.submissionStatus?.state).toBe('submitting');

    h.tick(120);
    expect(h.runStateMachine.state).toBe(RunState.RESULTS);
    expect(h.ctx.submissionStatus?.state).toBe('submitting');
  });

  it('3B) rejected submission records failed status and still reaches RESULTS', async () => {
    const h = makeRunHarness({ submissionBehavior: 'reject' });
    h.bootToReady();
    h.startRun();
    await h.flushAsync();

    h.endRunGameOver();
    h.tick(50);
    expect(h.runStateMachine.state).toBe(RunState.SUBMITTING);

    await h.flushAsync();
    h.tick(0);
    expect(h.runStateMachine.state).toBe(RunState.RESULTS);
    expect(h.ctx.submissionStatus).toEqual({
      state: 'fail',
      errorMessage: 'submit_failed_for_test',
    });
  });
});
