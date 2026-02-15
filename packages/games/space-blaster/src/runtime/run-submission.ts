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
    } satisfies SubmissionStatus;
    return 'fail';
  }
};
