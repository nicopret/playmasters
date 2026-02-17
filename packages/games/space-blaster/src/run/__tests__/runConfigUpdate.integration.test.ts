import {
  applyIncomingConfigUpdate,
  resolveConfigForNextRun,
} from '../../runtime';
import { RunState } from '../RunState';
import { makeRunHarness } from './harness/RunHarness';
import { createMinimalResolvedConfig } from './fixtures/resolvedConfig.minimal';

const createUpdatedResolvedConfig = () => ({
  ...createMinimalResolvedConfig(),
  configHash: 'a'.repeat(64),
  versionHash: 'b'.repeat(64),
});

describe('run config updates while game is open', () => {
  it('1) active run continues with old config after a new publish is detected', () => {
    const harness = makeRunHarness({
      initialResolvedConfig: createMinimalResolvedConfig(),
    });
    try {
      harness.bootToReady();
      harness.startRun();
      expect(harness.runStateMachine.state).toBe(RunState.PLAYING);
      expect(harness.ctx.configHash).toBe('f'.repeat(64));
      const activeRef = harness.ctx.resolvedConfig;

      const staged = applyIncomingConfigUpdate(
        harness.ctx,
        createUpdatedResolvedConfig(),
      );

      expect(staged).toBe(true);
      expect(harness.runStateMachine.state).toBe(RunState.PLAYING);
      expect(harness.ctx.configHash).toBe('f'.repeat(64));
      expect(harness.ctx.resolvedConfig).toBe(activeRef);
      expect(harness.ctx.pendingConfigHash).toBe('a'.repeat(64));
      expect(harness.ctx.hasPendingUpdate).toBe(true);
    } finally {
      harness.dispose();
    }
  });

  it('2) restart/remount uses latest resolved config after publish', () => {
    const firstRun = makeRunHarness({
      initialResolvedConfig: createMinimalResolvedConfig(),
    });

    try {
      firstRun.bootToReady();
      firstRun.startRun();
      applyIncomingConfigUpdate(firstRun.ctx, createUpdatedResolvedConfig());
      firstRun.endRunGameOver();
      firstRun.tick(50);
      firstRun.tick(120);

      const nextConfig = resolveConfigForNextRun(firstRun.ctx);
      expect(nextConfig.configHash).toBe('a'.repeat(64));

      const restarted = makeRunHarness({
        initialResolvedConfig: nextConfig,
      });
      try {
        restarted.bootToReady();
        restarted.startRun();
        expect(restarted.runStateMachine.state).toBe(RunState.PLAYING);
        expect(restarted.ctx.configHash).toBe('a'.repeat(64));
        expect(restarted.ctx.versionHash).toBe('b'.repeat(64));
      } finally {
        restarted.dispose();
      }
    } finally {
      firstRun.dispose();
    }
  });
});
