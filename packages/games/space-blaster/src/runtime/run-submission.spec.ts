import type { EmbeddedGameSdk } from '@playmasters/types';
import type { FinalScoreSummary } from '../scoring';
import { createRunContext } from './run-context';
import { registerRunIfAuthenticated } from './run-registration';
import { buildRunSubmissionPayload } from './run-submission';

const resolvedConfigExample = {
  configHash: 'f'.repeat(64),
  versionHash: 'e'.repeat(64),
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

const createSdkMock = (): EmbeddedGameSdk => ({
  isAuthenticated: true,
  startRun: jest.fn(async () => ({
    run: { runId: 'run-123', startedAt: '2026-02-16T00:00:00.000Z' },
    sessionToken: 'token-123',
  })),
  submitScore: jest.fn(async () => undefined),
});

describe('buildRunScoreSubmissionPayload', () => {
  const summary: FinalScoreSummary = {
    score: 1234,
    durationMs: 4567,
    levelReached: 3,
    waveReached: 5,
    stats: {
      shotsFired: 40,
      shotsHit: 22,
      kills: 18,
      wavesCleared: 4,
    },
  };

  it('uses the hash captured at run start', async () => {
    const ctx = createRunContext({
      sdk: createSdkMock(),
      resolvedConfig: resolvedConfigExample,
    });
    await registerRunIfAuthenticated(ctx);

    const payload = buildRunSubmissionPayload(summary, ctx);
    expect(payload).toEqual({
      runId: 'run-123',
      score: 1234,
      durationMs: 4567,
      levelReached: 3,
      waveReached: 5,
      stats: {
        shotsFired: 40,
        shotsHit: 22,
        kills: 18,
        wavesCleared: 4,
      },
      configHash: resolvedConfigExample.configHash,
      versionHash: resolvedConfigExample.versionHash,
    });
  });

  it('does not drift if active config hash changes after run start', async () => {
    const ctx = createRunContext({
      sdk: createSdkMock(),
      resolvedConfig: resolvedConfigExample,
    });
    await registerRunIfAuthenticated(ctx);
    const captured = ctx.runConfigHash;
    (ctx as unknown as { configHash: string }).configHash = '0'.repeat(64);

    const payload = buildRunSubmissionPayload(
      { ...summary, score: 99, durationMs: 1 },
      ctx,
    );
    expect(payload.configHash).toBe(captured);
  });

  it('whitelists allowed fields only and excludes hidden modifiers', async () => {
    const ctx = createRunContext({
      sdk: createSdkMock(),
      resolvedConfig: resolvedConfigExample,
    });
    await registerRunIfAuthenticated(ctx);

    const noisySummary = {
      ...summary,
      hiddenMultiplier: 999,
      debug: true,
      seed: 'abc',
      stats: {
        ...summary.stats,
        cheatFlags: ['godmode'],
      },
    } as unknown as FinalScoreSummary;
    const payload = buildRunSubmissionPayload(noisySummary, ctx);

    expect(payload).toEqual({
      runId: 'run-123',
      score: 1234,
      durationMs: 4567,
      levelReached: 3,
      waveReached: 5,
      stats: {
        shotsFired: 40,
        shotsHit: 22,
        kills: 18,
        wavesCleared: 4,
      },
      configHash: resolvedConfigExample.configHash,
      versionHash: resolvedConfigExample.versionHash,
    });
    expect((payload as { hiddenMultiplier?: number }).hiddenMultiplier).toBe(
      undefined,
    );
    expect((payload.stats as { cheatFlags?: string[] }).cheatFlags).toBe(
      undefined,
    );
  });

  it('is deterministic for the same inputs', async () => {
    const ctx = createRunContext({
      sdk: createSdkMock(),
      resolvedConfig: resolvedConfigExample,
    });
    await registerRunIfAuthenticated(ctx);

    const a = buildRunSubmissionPayload(summary, ctx);
    const b = buildRunSubmissionPayload(summary, ctx);
    expect(a).toEqual(b);
  });

  it('builds payload without auth state or runId', () => {
    const unauthSdk: EmbeddedGameSdk = {
      isAuthenticated: false,
      startRun: jest.fn(async () => {
        throw new Error('auth_required');
      }),
      submitScore: jest.fn(async () => undefined),
    };
    const ctx = createRunContext({
      sdk: unauthSdk,
      resolvedConfig: resolvedConfigExample,
    });
    ctx.runConfigHash = ctx.configHash;

    const payload = buildRunSubmissionPayload(summary, ctx);
    expect(payload.runId).toBeUndefined();
    expect(payload.configHash).toBe(resolvedConfigExample.configHash);
  });
});
