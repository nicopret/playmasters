import type { RunContext } from '../runtime';
import type { FinalScoreSummary } from '../scoring';
import { buildSubmitScorePayloadV1 } from './buildSubmitScorePayload';
import type { SubmitScorePayloadV1 } from './SubmitScorePayload';

const summary: FinalScoreSummary = {
  score: 3210,
  durationMs: 12345,
  levelReached: 2,
  waveReached: 4,
  stats: {
    shotsFired: 30,
    shotsHit: 21,
    kills: 19,
    wavesCleared: 3,
  },
};

const baseContext = {
  sdk: {
    isAuthenticated: true,
    startRun: jest.fn(async () => ({
      run: { runId: 'run-123', startedAt: '2026-01-01T00:00:00.000Z' },
      sessionToken: 'token-123',
    })),
    submitScore: jest.fn(async () => undefined),
  },
  resolvedConfig: {} as never,
  configHash: 'f'.repeat(64),
  versionHash: 'e'.repeat(64),
  mountedAt: '2026-01-01T00:00:00.000Z',
  hasPendingUpdate: false,
} as unknown as RunContext;

describe('buildSubmitScorePayloadV1', () => {
  it('builds payload with required fields when runId exists', () => {
    const ctx = {
      ...baseContext,
      runId: 'run-123',
      runConfigHash: 'f'.repeat(64),
      runVersionHash: 'e'.repeat(64),
    } as RunContext;

    const payload = buildSubmitScorePayloadV1({
      finalScore: summary,
      run: ctx,
      levelProgress: { levelNumber: 2, waveIndex: 3, wavesCleared: 3 },
    });

    const expected: SubmitScorePayloadV1 = {
      runId: 'run-123',
      score: 3210,
      durationMs: 12345,
      levelReached: 2,
      waveReached: 4,
      stats: {
        shotsFired: 30,
        shotsHit: 21,
        kills: 19,
        wavesCleared: 3,
      },
      configHash: 'f'.repeat(64),
      versionHash: 'e'.repeat(64),
    };
    expect(payload).toEqual(expected);
  });

  it('builds payload when unauthenticated/runId missing', () => {
    const ctx = {
      ...baseContext,
      runId: undefined,
      runConfigHash: 'f'.repeat(64),
      runVersionHash: undefined,
    } as RunContext;

    const payload = buildSubmitScorePayloadV1({
      finalScore: summary,
      run: ctx,
      levelProgress: { levelNumber: 2, waveIndex: 3, wavesCleared: 3 },
    });

    expect(payload.runId).toBeUndefined();
    expect(payload.configHash).toBe('f'.repeat(64));
    expect(payload.score).toBe(3210);
  });

  it('is deterministic for same inputs', () => {
    const ctx = {
      ...baseContext,
      runId: 'run-123',
      runConfigHash: 'f'.repeat(64),
    } as RunContext;

    const args = {
      finalScore: summary,
      run: ctx,
      levelProgress: { levelNumber: 2, waveIndex: 3, wavesCleared: 3 },
    } as const;
    const a = buildSubmitScorePayloadV1(args);
    const b = buildSubmitScorePayloadV1(args);
    expect(a).toEqual(b);
  });

  it('whitelists keys and excludes hidden modifiers', () => {
    const ctx = {
      ...baseContext,
      runId: 'run-123',
      runConfigHash: 'f'.repeat(64),
    } as RunContext;
    const noisySummary = {
      ...summary,
      hiddenMultiplier: 99,
      debug: true,
      stats: {
        ...summary.stats,
        rngSeed: 'seed-1',
      },
    } as unknown as FinalScoreSummary;

    const payload = buildSubmitScorePayloadV1({
      finalScore: noisySummary,
      run: ctx,
      levelProgress: { levelNumber: 2, waveIndex: 3, wavesCleared: 3 },
    });

    expect(Object.keys(payload).sort()).toEqual(
      [
        'configHash',
        'durationMs',
        'levelReached',
        'runId',
        'score',
        'stats',
        'versionHash',
        'waveReached',
      ].sort(),
    );
    expect(Object.keys(payload.stats).sort()).toEqual(
      ['kills', 'shotsFired', 'shotsHit', 'wavesCleared'].sort(),
    );
  });
});
