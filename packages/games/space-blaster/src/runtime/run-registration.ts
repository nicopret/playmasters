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
  ctx.runConfigHash = undefined;
  ctx.runVersionHash = undefined;
};

const captureRunHashesAtStart = (ctx: RunContext): void => {
  if (ctx.runConfigHash) return;
  const configHash = ctx.configHash.trim();
  if (configHash.length === 0) {
    throw new Error('Run start aborted: missing configHash in RunContext.');
  }
  ctx.runConfigHash = configHash;
  const versionHash = ctx.versionHash?.trim();
  ctx.runVersionHash =
    versionHash && versionHash.length > 0 ? versionHash : undefined;
};

export const registerRunIfAuthenticated = async (
  ctx: RunContext,
): Promise<RunRegistrationResult> => {
  if (ctx.runRegistrationStarted) {
    return 'already_started';
  }
  captureRunHashesAtStart(ctx);
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
