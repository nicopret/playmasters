import type { RunContext } from './run-context';

export type RunScoreSubmissionPayload = {
  score: number;
  durationMs?: number;
  configHash: string;
  versionHash?: string;
};

export const buildRunScoreSubmissionPayload = (
  ctx: RunContext,
  score: number,
  durationMs?: number,
): RunScoreSubmissionPayload => {
  const configHash = ctx.runConfigHash?.trim();
  if (!configHash) {
    throw new Error(
      'Cannot submit score before run start hash capture. Missing runConfigHash.',
    );
  }
  const versionHash = ctx.runVersionHash?.trim();
  return {
    score,
    durationMs,
    configHash,
    versionHash:
      versionHash && versionHash.length > 0 ? versionHash : undefined,
  };
};
