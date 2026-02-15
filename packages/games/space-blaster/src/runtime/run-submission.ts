import type { FinalScoreSummary } from '../scoring';
import type { RunContext } from './run-context';

export type RunSubmissionPayload = {
  runId?: string;
  score: number;
  durationMs: number;
  levelReached: number;
  waveReached: number;
  stats: {
    shotsFired: number;
    shotsHit: number;
    kills: number;
    wavesCleared: number;
  };
  configHash: string;
  versionHash?: string;
};

export type RunSubmissionResult =
  | 'already_attempted'
  | 'success'
  | 'fail'
  | 'skipped';

const toNonNegativeInt = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
};

export const buildRunSubmissionPayload = (
  summary: FinalScoreSummary,
  ctx: RunContext,
): RunSubmissionPayload => {
  const configHash = ctx.runConfigHash?.trim();
  if (!configHash) {
    throw new Error(
      'Cannot submit score before run start hash capture. Missing runConfigHash.',
    );
  }
  const runId = ctx.runId?.trim();
  const versionHash = ctx.runVersionHash?.trim();
  return {
    runId: runId && runId.length > 0 ? runId : undefined,
    score: toNonNegativeInt(summary.score),
    durationMs: toNonNegativeInt(summary.durationMs),
    levelReached: Math.max(1, toNonNegativeInt(summary.levelReached)),
    waveReached: Math.max(1, toNonNegativeInt(summary.waveReached)),
    stats: {
      shotsFired: toNonNegativeInt(summary.stats.shotsFired),
      shotsHit: toNonNegativeInt(summary.stats.shotsHit),
      kills: toNonNegativeInt(summary.stats.kills),
      wavesCleared: toNonNegativeInt(summary.stats.wavesCleared),
    },
    configHash,
    versionHash:
      versionHash && versionHash.length > 0 ? versionHash : undefined,
  };
};

const toSafeErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }
  return 'Submission failed.';
};

const isSdkAuthenticated = (ctx: RunContext): boolean =>
  ctx.sdk.isAuthenticated ?? true;

export const attemptRunSubmission = async (args: {
  ctx: RunContext;
  payload: RunSubmissionPayload;
  nowMs: number;
}): Promise<RunSubmissionResult> => {
  const { ctx, payload, nowMs } = args;
  if (ctx.submissionAttempted) {
    return 'already_attempted';
  }
  ctx.submissionAttempted = true;

  if (!isSdkAuthenticated(ctx)) {
    ctx.submissionStatus = { state: 'skipped' };
    return 'skipped';
  }
  if (!ctx.runId) {
    ctx.submissionStatus = {
      state: 'skipped',
      errorMessage: 'No runId available for submission.',
    };
    return 'skipped';
  }

  try {
    await ctx.sdk.submitScore(payload);
    ctx.submissionStatus = {
      state: 'success',
      submittedAtMs: nowMs,
    };
    return 'success';
  } catch (error) {
    ctx.submissionStatus = {
      state: 'fail',
      errorMessage: toSafeErrorMessage(error),
    };
    return 'fail';
  }
};
