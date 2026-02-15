import type { EmbeddedGameSdk } from '@playmasters/types';
import { createRunContext } from './run-context';
import {
  registerRunIfAuthenticated,
  resetRunRegistration,
} from './run-registration';

const resolvedConfigExample = {
  configHash: 'f'.repeat(64),
  gameConfig: { defaultLives: 3 },
  levelConfigs: [
    {
      layoutId: 'layout-a',
      enemyTypes: ['enemy-a'],
      waves: [{ enemyId: 'enemy-a', count: 1 }],
    },
  ],
  heroCatalog: { entries: [{ heroId: 'hero-a', defaultAmmoId: 'ammo-a' }] },
  enemyCatalog: { entries: [{ enemyId: 'enemy-a' }] },
  ammoCatalog: { entries: [{ ammoId: 'ammo-a' }] },
  formationLayouts: { entries: [{ layoutId: 'layout-a' }] },
  scoreConfig: { baseEnemyScores: [{ enemyId: 'enemy-a', score: 100 }] },
};

const createSdkMock = (opts?: {
  isAuthenticated?: boolean;
  failStart?: boolean;
}): EmbeddedGameSdk => ({
  isAuthenticated: opts?.isAuthenticated,
  startRun: jest.fn(async () => {
    if (opts?.failStart) {
      throw new Error('start_failed');
    }
    return {
      run: { runId: 'run-123', startedAt: '2026-02-16T00:00:00.000Z' },
      sessionToken: 'token-123',
    };
  }),
  submitScore: jest.fn(async () => undefined),
});

describe('run registration lifecycle', () => {
  it('calls startRun once for authenticated sessions and stores runId', async () => {
    const sdk = createSdkMock({ isAuthenticated: true });
    const ctx = createRunContext({
      sdk,
      resolvedConfig: resolvedConfigExample,
    });

    await registerRunIfAuthenticated(ctx);
    await registerRunIfAuthenticated(ctx);

    expect(sdk.startRun).toHaveBeenCalledTimes(1);
    expect(ctx.runId).toBe('run-123');
  });

  it('skips startRun for unauthenticated sessions', async () => {
    const sdk = createSdkMock({ isAuthenticated: false });
    const ctx = createRunContext({
      sdk,
      resolvedConfig: resolvedConfigExample,
    });

    const result = await registerRunIfAuthenticated(ctx);

    expect(result).toBe('skipped_unauthenticated');
    expect(sdk.startRun).not.toHaveBeenCalled();
    expect(ctx.runId).toBeUndefined();
  });

  it('handles startRun failure without throwing and keeps runId undefined', async () => {
    const sdk = createSdkMock({ isAuthenticated: true, failStart: true });
    const ctx = createRunContext({
      sdk,
      resolvedConfig: resolvedConfigExample,
    });

    const result = await registerRunIfAuthenticated(ctx);

    expect(result).toBe('failed');
    expect(sdk.startRun).toHaveBeenCalledTimes(1);
    expect(ctx.runId).toBeUndefined();
  });

  it('calls startRun again after resetting registration for a new run', async () => {
    const sdk = createSdkMock({ isAuthenticated: true });
    const ctx = createRunContext({
      sdk,
      resolvedConfig: resolvedConfigExample,
    });

    await registerRunIfAuthenticated(ctx);
    resetRunRegistration(ctx);
    await registerRunIfAuthenticated(ctx);

    expect(sdk.startRun).toHaveBeenCalledTimes(2);
  });
});
