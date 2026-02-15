import type { EmbeddedGameSdk } from '@playmasters/types';
import type { RunContext } from './run-context';

export type RunRegistrationResult =
  | 'already_started'
  | 'started'
  | 'skipped_unauthenticated'
  | 'failed';

export const isSdkAuthenticated = (sdk: EmbeddedGameSdk): boolean =>
  sdk.isAuthenticated ?? true;

export const resetRunRegistration = (ctx: RunContext): void => {
  ctx.runRegistrationStarted = false;
  ctx.runId = undefined;
};

export const registerRunIfAuthenticated = async (
  ctx: RunContext,
): Promise<RunRegistrationResult> => {
  if (ctx.runRegistrationStarted) {
    return 'already_started';
  }
  ctx.runRegistrationStarted = true;
  ctx.runId = undefined;

  if (!isSdkAuthenticated(ctx.sdk)) {
    return 'skipped_unauthenticated';
  }

  try {
    const started = await ctx.sdk.startRun();
    ctx.runId = started.run.runId;
    return 'started';
  } catch {
    return 'failed';
  }
};
