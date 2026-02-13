import type { EmbeddedGameSdk } from '@playmasters/types';
import { createBootstrapDependencies } from './bootstrap';
import { createRunContext } from './runtime';

const createSdkMock = (): EmbeddedGameSdk => ({
  startRun: jest.fn(async () => ({
    run: { runId: 'run-1', startedAt: '2026-02-13T00:00:00.000Z' },
    sessionToken: 'token-1',
  })),
  submitScore: jest.fn(async () => undefined),
});

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

describe('createBootstrapDependencies', () => {
  it('uses a single injected source from RunContext', () => {
    const ctx = createRunContext({
      sdk: createSdkMock(),
      resolvedConfig: resolvedConfigExample,
    });

    const deps = createBootstrapDependencies(ctx);

    expect(deps.ctx).toBe(ctx);
    expect(deps.sdk).toBe(ctx.sdk);
    expect(deps.resolvedConfig).toBe(ctx.resolvedConfig);
    expect(deps.gameConfig).toBe(ctx.resolvedConfig.gameConfig);
    expect(deps.levelConfigs).toBe(ctx.resolvedConfig.levelConfigs);
    expect(deps.enemyCatalog).toBe(ctx.resolvedConfig.enemyCatalog);
    expect(deps.scoreConfig).toBe(ctx.resolvedConfig.scoreConfig);
  });

  it('does not fetch config over network during bootstrap dependency creation', () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = jest.fn();
    Object.assign(globalThis, { fetch: fetchSpy });
    try {
      const ctx = createRunContext({
        sdk: createSdkMock(),
        resolvedConfig: resolvedConfigExample,
      });
      createBootstrapDependencies(ctx);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      Object.assign(globalThis, { fetch: originalFetch });
    }
  });
});
