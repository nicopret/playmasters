import type { RunContext } from '../runtime/run-context';
import type { FinalScoreSummary } from '../scoring';

export type SubmitScorePayload = {
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

const toNonNegativeInt = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
};

export const buildSubmitScorePayload = (
  summary: FinalScoreSummary,
  ctx: RunContext,
): SubmitScorePayload => {
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
