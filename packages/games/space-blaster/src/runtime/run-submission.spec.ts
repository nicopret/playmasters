import type { EmbeddedGameSdk } from '@playmasters/types';
import type { FinalScoreSummary } from '../scoring';
import { createRunContext } from './run-context';
import { registerRunIfAuthenticated } from './run-registration';
import {
  attemptRunSubmission,
  buildRunSubmissionPayload,
} from './run-submission';

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

describe('run submission payload', () => {
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

describe('attemptRunSubmission', () => {
  const summary: FinalScoreSummary = {
    score: 4500,
    durationMs: 1000,
    levelReached: 2,
    waveReached: 3,
    stats: {
      shotsFired: 20,
      shotsHit: 12,
      kills: 10,
      wavesCleared: 2,
    },
  };

  it('submits exactly once per run when authenticated and runId exists', async () => {
    const sdk = createSdkMock();
    const ctx = createRunContext({
      sdk,
      resolvedConfig: resolvedConfigExample,
    });
    await registerRunIfAuthenticated(ctx);
    const payload = buildRunSubmissionPayload(summary, ctx);

    const first = await attemptRunSubmission({
      ctx,
      payload,
      nowMs: 1000,
    });
    const second = await attemptRunSubmission({
      ctx,
      payload,
      nowMs: 1100,
    });

    expect(first).toBe('success');
    expect(second).toBe('already_attempted');
    expect(sdk.submitScore).toHaveBeenCalledTimes(1);
    expect(ctx.submissionStatus?.state).toBe('success');
    expect(ctx.submissionStatus?.submittedAtMs).toBe(1000);
  });

  it('marks failed status with message when submitScore rejects', async () => {
    const sdk: EmbeddedGameSdk = {
      isAuthenticated: true,
      startRun: jest.fn(async () => ({
        run: { runId: 'run-123', startedAt: '2026-02-16T00:00:00.000Z' },
        sessionToken: 'token-123',
      })),
      submitScore: jest.fn(async () => {
        throw new Error('submit_failed');
      }),
    };
    const ctx = createRunContext({
      sdk,
      resolvedConfig: resolvedConfigExample,
    });
    await registerRunIfAuthenticated(ctx);
    const payload = buildRunSubmissionPayload(summary, ctx);

    const result = await attemptRunSubmission({
      ctx,
      payload,
      nowMs: 2000,
    });

    expect(result).toBe('fail');
    expect(ctx.submissionStatus?.state).toBe('fail');
    expect(ctx.submissionStatus?.errorMessage).toBe('submit_failed');
  });

  it('skips when unauthenticated and does not call submit', async () => {
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

    const result = await attemptRunSubmission({
      ctx,
      payload,
      nowMs: 50,
    });

    expect(result).toBe('skipped');
    expect(unauthSdk.submitScore).not.toHaveBeenCalled();
    expect(ctx.submissionStatus?.state).toBe('skipped');
  });

  it('skips when runId is missing', async () => {
    const ctx = createRunContext({
      sdk: createSdkMock(),
      resolvedConfig: resolvedConfigExample,
    });
    ctx.runConfigHash = ctx.configHash;
    const payload = buildRunSubmissionPayload(summary, ctx);

    const result = await attemptRunSubmission({
      ctx,
      payload,
      nowMs: 75,
    });

    expect(result).toBe('skipped');
    expect(ctx.submissionStatus?.state).toBe('skipped');
    expect(ctx.submissionStatus?.errorMessage).toBe(
      'No runId available for submission.',
    );
  });
});
