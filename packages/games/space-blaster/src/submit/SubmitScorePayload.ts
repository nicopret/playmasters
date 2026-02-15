/**
 * Canonical score submission payload (V1).
 *
 * Notes:
 * - `levelReached` is 1-based (matches LevelSystem.getLevelNumber()).
 * - `waveReached` is 1-based derived from a zero-based `waveIndex`.
 * - Only auditable/user-visible totals are included; hidden modifiers are excluded by design.
 */
export interface SubmitScorePayloadV1 {
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
}
