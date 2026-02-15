import type { RunContext } from './run-context';
import type { SubmitScorePayload } from '../submit';
import type { SubmissionStatus } from '../submit';

export type RunSubmissionResult =
  | 'already_attempted'
  | 'success'
  | 'fail'
  | 'skipped';

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

const toOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
};

const extractSubmissionMeta = (
  response: unknown,
): { rank?: number; personalBest?: boolean; bestScore?: number } => {
  if (!response || typeof response !== 'object') {
    return {};
  }
  const obj = response as Record<string, unknown>;
  const rank = toOptionalNumber(obj['rank']);
  const bestScore = toOptionalNumber(obj['bestScore']);
  const personalBestValue = obj['personalBest'];
  const personalBest =
    typeof personalBestValue === 'boolean' ? personalBestValue : undefined;
  return {
    rank: typeof rank === 'number' ? Math.max(1, Math.floor(rank)) : undefined,
    personalBest,
    bestScore:
      typeof bestScore === 'number'
        ? Math.max(0, Math.floor(bestScore))
        : undefined,
  };
};

export const attemptRunSubmission = async (args: {
  ctx: RunContext;
  payload: SubmitScorePayload;
  nowMs: number;
}): Promise<RunSubmissionResult> => {
  const { ctx, payload, nowMs } = args;
  if (ctx.submissionAttempted) {
    return 'already_attempted';
  }
  ctx.submissionAttempted = true;
  ctx.submissionStatus = { state: 'submitting' };

  if (!isSdkAuthenticated(ctx)) {
    ctx.submissionStatus = {
      state: 'skipped',
      reason: 'unauthenticated',
    } satisfies SubmissionStatus;
    return 'skipped';
  }
  if (!ctx.runId) {
    ctx.submissionStatus = {
      state: 'skipped',
      reason: 'missingRunId',
    };
    return 'skipped';
  }

  try {
    const response = (await ctx.sdk.submitScore(payload)) as unknown;
    const submissionMeta = extractSubmissionMeta(response);
    ctx.submissionStatus = {
      state: 'success',
      submittedAtMs: nowMs,
      ...submissionMeta,
    };
    return 'success';
  } catch (error) {
    ctx.submissionStatus = {
      state: 'fail',
      errorMessage: toSafeErrorMessage(error),
    } satisfies SubmissionStatus;
    return 'fail';
  }
};
