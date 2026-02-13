import {
  resolvedConfigExampleV1,
  type EmbeddedGameSdk,
  validateResolvedGameConfigV1,
} from '@playmasters/types';
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

const cloneFixture = () =>
  JSON.parse(
    JSON.stringify(resolvedConfigExampleV1),
  ) as typeof resolvedConfigExampleV1;

describe('createRunContext', () => {
  it('keeps resolved example aligned with runtime validator', () => {
    const result = validateResolvedGameConfigV1(cloneFixture());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.levelConfigs.length).toBeGreaterThan(0);
    expect(result.value.enemyCatalog.entries.length).toBeGreaterThan(0);
    expect(result.value.scoreConfig.baseEnemyScores.length).toBeGreaterThan(0);
  });

  it('boots with only sdk + resolvedConfig and does not fetch config', () => {
    const sdk = createSdkMock();
    const originalFetch = globalThis.fetch;
    const fetchSpy = jest.fn();
    Object.assign(globalThis, { fetch: fetchSpy });

    try {
      const context = createRunContext({
        sdk,
        resolvedConfig: cloneFixture(),
      });

      expect(context.configHash).toBe(resolvedConfigExampleV1.configHash);
      expect(context.versionHash).toBe(resolvedConfigExampleV1.versionHash);
      expect(context.hasPendingUpdate).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      Object.assign(globalThis, { fetch: originalFetch });
    }
  });

  it('creates isolated context objects for separate runs', () => {
    const sdkA = createSdkMock();
    const sdkB = createSdkMock();

    const cfgA = { ...cloneFixture(), configHash: 'a'.repeat(64) };
    const cfgB = { ...cloneFixture(), configHash: 'b'.repeat(64) };

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

  it('keeps active config frozen and stores pending update only for next run', () => {
    const ctx = createRunContext({
      sdk: createSdkMock(),
      resolvedConfig: {
        ...cloneFixture(),
        configHash: '1'.repeat(64),
      },
    });
    const activeRef = ctx.resolvedConfig;

    const updated = applyIncomingConfigUpdate(ctx, {
      ...cloneFixture(),
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
      resolvedConfig: cloneFixture(),
    });

    const updated = applyIncomingConfigUpdate(ctx, cloneFixture());
    expect(updated).toBe(false);
    expect(ctx.hasPendingUpdate).toBe(false);
    expect(ctx.pendingResolvedConfig).toBeUndefined();
  });

  it('notifies optional pending-update hook when new hash is staged', () => {
    const ctx = createRunContext({
      sdk: createSdkMock(),
      resolvedConfig: cloneFixture(),
    });
    const notify = jest.fn();

    const updated = applyIncomingConfigUpdate(
      ctx,
      {
        ...cloneFixture(),
        configHash: '3'.repeat(64),
      },
      notify,
    );

    expect(updated).toBe(true);
    expect(notify).toHaveBeenCalledWith({
      currentHash: resolvedConfigExampleV1.configHash,
      nextHash: '3'.repeat(64),
    });
  });
});
