import {
  applyIncomingConfigUpdate,
  resolveConfigForNextRun,
} from '../../runtime';
import { RunState } from '../RunState';
import { makeRunHarness } from './harness/RunHarness';
import { createMinimalResolvedConfig } from './fixtures/resolvedConfig.minimal';

const createConfigB = () => ({
  ...createMinimalResolvedConfig(),
  configHash: '9'.repeat(64),
  versionHash: '8'.repeat(64),
});

describe('freeze semantics', () => {
  it('keeps run config reference and hash stable during active run, including pause/resume', () => {
    const harness = makeRunHarness({
      initialResolvedConfig: createMinimalResolvedConfig(),
    });

    try {
      harness.bootToReady();
      harness.startRun();
      expect(harness.runStateMachine.state).toBe(RunState.PLAYING);

      const activeConfigRef = harness.ctx.resolvedConfig;
      const activeHash = harness.ctx.configHash;

      harness.pause();
      const staged = applyIncomingConfigUpdate(harness.ctx, createConfigB());
      harness.tick(100);
      harness.resume();
      harness.tick(16);

      expect(staged).toBe(true);
      expect(harness.runStateMachine.state).toBe(RunState.PLAYING);
      expect(harness.ctx.resolvedConfig).toBe(activeConfigRef);
      expect(harness.ctx.configHash).toBe(activeHash);
      expect(harness.ctx.pendingConfigHash).toBe('9'.repeat(64));
      expect(harness.ctx.hasPendingUpdate).toBe(true);
    } finally {
      harness.dispose();
    }
  });

  it('applies staged config only on the next run context after restart/remount', () => {
    const currentRun = makeRunHarness({
      initialResolvedConfig: createMinimalResolvedConfig(),
    });

    try {
      currentRun.bootToReady();
      currentRun.startRun();
      applyIncomingConfigUpdate(currentRun.ctx, createConfigB());
      currentRun.endRunGameOver();
      currentRun.tick(50);
      currentRun.tick(120);

      const nextRunConfig = resolveConfigForNextRun(currentRun.ctx);
      expect(nextRunConfig.configHash).toBe('9'.repeat(64));
      expect(currentRun.ctx.configHash).toBe('f'.repeat(64));

      const restarted = makeRunHarness({
        initialResolvedConfig: nextRunConfig,
      });
      try {
        restarted.bootToReady();
        restarted.startRun();
        expect(restarted.runStateMachine.state).toBe(RunState.PLAYING);
        expect(restarted.ctx.configHash).toBe('9'.repeat(64));
        expect(restarted.ctx.versionHash).toBe('8'.repeat(64));
      } finally {
        restarted.dispose();
      }
    } finally {
      currentRun.dispose();
    }
  });
});
