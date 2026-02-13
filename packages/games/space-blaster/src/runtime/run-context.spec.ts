import type { EmbeddedGameSdk } from '@playmasters/types';
import { createRunContext } from './run-context';

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
  levelConfigs: [{ layoutId: 'layout-a', waves: [{ enemyId: 'enemy-a' }] }],
  heroCatalog: { entries: [{ heroId: 'hero-a', defaultAmmoId: 'ammo-a' }] },
  enemyCatalog: { entries: [{ enemyId: 'enemy-a' }] },
  ammoCatalog: { entries: [{ ammoId: 'ammo-a' }] },
  formationLayouts: { entries: [{ layoutId: 'layout-a' }] },
  scoreConfig: { baseEnemyScores: [{ enemyId: 'enemy-a', score: 100 }] },
};

describe('createRunContext', () => {
  it('boots with only sdk + resolvedConfig and does not fetch config', () => {
    const sdk = createSdkMock();
    const originalFetch = globalThis.fetch;
    const fetchSpy = jest.fn();
    Object.assign(globalThis, { fetch: fetchSpy });

    try {
      const context = createRunContext({
        sdk,
        resolvedConfig: resolvedConfigExample,
      });

      expect(context.configHash).toBe(resolvedConfigExample.configHash);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      Object.assign(globalThis, { fetch: originalFetch });
    }
  });

  it('creates isolated context objects for separate runs', () => {
    const sdkA = createSdkMock();
    const sdkB = createSdkMock();

    const cfgA = { ...resolvedConfigExample, configHash: 'a'.repeat(64) };
    const cfgB = { ...resolvedConfigExample, configHash: 'b'.repeat(64) };

    const runA = createRunContext({ sdk: sdkA, resolvedConfig: cfgA });
    const runB = createRunContext({ sdk: sdkB, resolvedConfig: cfgB });

    expect(runA).not.toBe(runB);
    expect(runA.configHash).toBe('a'.repeat(64));
    expect(runB.configHash).toBe('b'.repeat(64));
  });

  it('throws actionable validation errors for invalid resolved config', () => {
    expect(() =>
      createRunContext({
        sdk: createSdkMock(),
        resolvedConfig: { configHash: 123 },
      }),
    ).toThrow('Root configHash: Missing configHash (string).');
  });
});
