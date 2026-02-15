import type { RunContext } from '../runtime/run-context';
import type { FinalScoreSummary } from '../scoring';
import type { SubmitScorePayloadV1 } from './SubmitScorePayload';

const toNonNegativeInt = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
};

/**
 * Builds the canonical submit payload from authoritative local sources only.
 *
 * Allowed inputs:
 * - `finalScore`: finalized score summary (ScoreSystem-derived)
 * - `run`: run metadata/hash context
 * - `levelProgress`: level/wave progression at run end
 *
 * Disallowed by contract:
 * - hidden modifiers, debug/seed/rng values, unpublished config knobs.
 */
export const buildSubmitScorePayloadV1 = (args: {
  finalScore: FinalScoreSummary;
  run: RunContext;
  levelProgress: {
    levelNumber: number; // 1-based
    waveIndex: number; // 0-based
    wavesCleared: number;
  };
}): SubmitScorePayloadV1 => {
  const { finalScore, run, levelProgress } = args;
  const configHash = run.runConfigHash?.trim() ?? run.configHash?.trim();
  if (!configHash) {
    throw new Error(
      'Cannot submit score before run start hash capture. Missing runConfigHash.',
    );
  }
  const runId = run.runId?.trim();
  const versionHash = (run.runVersionHash ?? run.versionHash)?.trim();
  const levelReached = Math.max(1, toNonNegativeInt(levelProgress.levelNumber));
  const waveReached = Math.max(
    1,
    toNonNegativeInt(levelProgress.waveIndex) + 1,
  );
  return {
    runId: runId && runId.length > 0 ? runId : undefined,
    score: toNonNegativeInt(finalScore.score),
    durationMs: toNonNegativeInt(finalScore.durationMs),
    levelReached,
    waveReached,
    stats: {
      shotsFired: toNonNegativeInt(finalScore.stats.shotsFired),
      shotsHit: toNonNegativeInt(finalScore.stats.shotsHit),
      kills: toNonNegativeInt(finalScore.stats.kills),
      wavesCleared: toNonNegativeInt(levelProgress.wavesCleared),
    },
    configHash,
    versionHash:
      versionHash && versionHash.length > 0 ? versionHash : undefined,
  };
};

// Backward-compatible alias for existing call sites/tests.
export const buildSubmitScorePayload = (
  summary: FinalScoreSummary,
  ctx: RunContext,
): SubmitScorePayloadV1 =>
  buildSubmitScorePayloadV1({
    finalScore: summary,
    run: ctx,
    levelProgress: {
      levelNumber: summary.levelReached,
      waveIndex: Math.max(0, summary.waveReached - 1),
      wavesCleared: summary.stats.wavesCleared,
    },
  });

export type SubmitScorePayload = SubmitScorePayloadV1;
