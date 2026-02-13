import type { EmbeddedGameSdk } from '@playmasters/types';
import {
  applyIncomingConfigUpdate,
  createRunContext,
  resolveConfigForNextRun,
} from './run-context';

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
      expect(context.versionHash).toBeUndefined();
      expect(context.hasPendingUpdate).toBe(false);
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

  it('rejects unresolved layout references', () => {
    expect(() =>
      createRunContext({
        sdk: createSdkMock(),
        resolvedConfig: {
          ...resolvedConfigExample,
          levelConfigs: [
            {
              layoutId: 'layout-missing',
              waves: [{ enemyId: 'enemy-a', count: 1 }],
            },
          ],
        },
      }),
    ).toThrow(
      "FormationLayouts levelConfigs[0].layoutId: layoutId 'layout-missing' referenced by levelConfigs is missing in FormationLayouts.",
    );
  });

  it('rejects unresolved enemy references from waves and score config', () => {
    expect(() =>
      createRunContext({
        sdk: createSdkMock(),
        resolvedConfig: {
          ...resolvedConfigExample,
          levelConfigs: [
            {
              layoutId: 'layout-a',
              waves: [{ enemyId: 'enemy-missing', count: 1 }],
            },
          ],
          scoreConfig: {
            baseEnemyScores: [{ enemyId: 'enemy-missing', score: 100 }],
          },
        },
      }),
    ).toThrow(
      "EnemyCatalog levelConfigs[0].waves[0].enemyId: enemyId 'enemy-missing' referenced by waves is missing in EnemyCatalog.",
    );
  });

  it('rejects unresolved hero default ammo references', () => {
    expect(() =>
      createRunContext({
        sdk: createSdkMock(),
        resolvedConfig: {
          ...resolvedConfigExample,
          heroCatalog: {
            entries: [{ heroId: 'hero-a', defaultAmmoId: 'ammo-missing' }],
          },
        },
      }),
    ).toThrow(
      "AmmoCatalog heroCatalog.entries[0].defaultAmmoId: defaultAmmoId 'ammo-missing' referenced by hero is missing in AmmoCatalog.",
    );
  });

  it('keeps active config frozen and stores pending update only for next run', () => {
    const ctx = createRunContext({
      sdk: createSdkMock(),
      resolvedConfig: {
        ...resolvedConfigExample,
        configHash: '1'.repeat(64),
      },
    });
    const activeRef = ctx.resolvedConfig;

    const updated = applyIncomingConfigUpdate(ctx, {
      ...resolvedConfigExample,
      configHash: '2'.repeat(64),
    });

    expect(updated).toBe(true);
    expect(ctx.resolvedConfig).toBe(activeRef);
    expect(ctx.configHash).toBe('1'.repeat(64));
    expect(ctx.hasPendingUpdate).toBe(true);
    expect(ctx.pendingConfigHash).toBe('2'.repeat(64));
    expect(resolveConfigForNextRun(ctx).configHash).toBe('2'.repeat(64));
  });

  it('ignores same-hash incoming config updates', () => {
    const ctx = createRunContext({
      sdk: createSdkMock(),
      resolvedConfig: resolvedConfigExample,
    });

    const updated = applyIncomingConfigUpdate(ctx, resolvedConfigExample);
    expect(updated).toBe(false);
    expect(ctx.hasPendingUpdate).toBe(false);
    expect(ctx.pendingResolvedConfig).toBeUndefined();
  });

  it('notifies optional pending-update hook when new hash is staged', () => {
    const ctx = createRunContext({
      sdk: createSdkMock(),
      resolvedConfig: resolvedConfigExample,
    });
    const notify = jest.fn();

    const updated = applyIncomingConfigUpdate(
      ctx,
      {
        ...resolvedConfigExample,
        configHash: '3'.repeat(64),
      },
      notify,
    );

    expect(updated).toBe(true);
    expect(notify).toHaveBeenCalledWith({
      currentHash: resolvedConfigExample.configHash,
      nextHash: '3'.repeat(64),
    });
  });
});
