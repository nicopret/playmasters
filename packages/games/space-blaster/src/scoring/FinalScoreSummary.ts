import type { ScoreState } from './ScoreState';

export type FinalScoreStats = {
  shotsFired: number;
  shotsHit: number;
  kills: number;
  wavesCleared: number;
};

export type FinalScoreSummary = {
  score: number;
  durationMs: number;
  levelReached: number;
  waveReached: number;
  stats: FinalScoreStats;
};

const toNonNegativeInt = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
};

export const buildFinalScoreSummary = (args: {
  scoreState: Readonly<ScoreState>;
  durationMs?: number;
  levelReached?: number;
  waveReached?: number;
  wavesCleared?: number;
}): FinalScoreSummary => ({
  score: toNonNegativeInt(args.scoreState.score),
  durationMs: toNonNegativeInt(args.durationMs ?? 0),
  levelReached: Math.max(1, toNonNegativeInt(args.levelReached ?? 1)),
  waveReached: Math.max(1, toNonNegativeInt(args.waveReached ?? 1)),
  stats: {
    shotsFired: toNonNegativeInt(args.scoreState.shotsFired),
    shotsHit: toNonNegativeInt(args.scoreState.shotsHit),
    kills: toNonNegativeInt(args.scoreState.breakdownTotals.kills),
    wavesCleared: toNonNegativeInt(args.wavesCleared ?? 0),
  },
});
