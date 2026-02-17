import { RunState } from '..';
import { makeRunHarness } from './harness/RunHarness';

describe('overlay blocking integration (ticket #155)', () => {
  it('1) pause freezes simulation and sim-driven timers', () => {
    const h = makeRunHarness({ submissionBehavior: 'resolve' });
    h.bootToReady();
    h.startRun();
    expect(h.runStateMachine.state).toBe(RunState.PLAYING);

    h.tick(60);
    const beforePauseNow = h.getSimNowMs();
    const beforePauseAdvanceCount = h.getSimAdvanceCount();

    h.pause();
    h.tick(1000);
    expect(h.runStateMachine.state).toBe(RunState.PLAYING);
    expect(h.getSimNowMs()).toBe(beforePauseNow);
    expect(h.getSimAdvanceCount()).toBe(beforePauseAdvanceCount);

    h.openSettings();
    h.tick(500);
    expect(h.getSimNowMs()).toBe(beforePauseNow);
    expect(h.getSimAdvanceCount()).toBe(beforePauseAdvanceCount);

    h.closeSettings();
    h.resume();
    h.tick(40);
    expect(h.getSimNowMs()).toBe(beforePauseNow + 40);
    expect(h.getSimAdvanceCount()).toBe(beforePauseAdvanceCount + 1);
  });

  it('2) resume restores simulation without desync', () => {
    const h = makeRunHarness({ submissionBehavior: 'resolve' });
    h.bootToReady();
    h.startRun();
    expect(h.runStateMachine.state).toBe(RunState.PLAYING);

    h.tick(33);
    const beforePauseNow = h.getSimNowMs();

    h.pause();
    h.tick(777);
    expect(h.getSimNowMs()).toBe(beforePauseNow);

    h.resume();
    h.tick(25);
    expect(h.getSimNowMs()).toBe(beforePauseNow + 25);
    expect(h.runStateMachine.state).toBe(RunState.PLAYING);
  });

  it('3) restart from results overlay resets run context and pool activity cleanly', async () => {
    const h = makeRunHarness({ submissionBehavior: 'resolve' });
    const baselineMetrics = h.getPoolBaseline();

    h.bootToReady();
    h.startRun();
    await h.flushAsync();
    h.spawnPoolActivity();

    const activeBeforeResults = h.getPoolMetrics();
    expect(activeBeforeResults.projectile.active).toBeGreaterThan(0);
    expect(activeBeforeResults.explosion.active).toBeGreaterThan(0);

    h.endRunGameOver();
    h.tick(0);
    h.tick(50);
    await h.flushAsync();
    h.tick(0);
    expect(h.runStateMachine.state).toBe(RunState.RESULTS);

    const previousConfigHash = h.ctx.configHash;
    h.restartFromOverlay();
    h.tick(0);
    expect(h.runStateMachine.state).toBe(RunState.COUNTDOWN);
    expect(h.ctx.submissionStatus).toEqual({ state: 'idle' });
    expect(h.ctx.submissionAttempted).toBe(false);

    h.tick(100);
    expect(h.runStateMachine.state).toBe(RunState.PLAYING);

    expect(h.ctx.configHash).toBe(previousConfigHash);
    expect(h.getPoolMetrics()).toEqual(baselineMetrics);
  });
});
