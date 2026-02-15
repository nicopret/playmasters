export type EnemyScoreBreakdown = {
  kills: number;
  points: number;
};

export type ScoreState = {
  score: number;
  comboCount: number;
  comboExpiresAtMs: number | null;
  currentTierIndex: number | null;
  lastTierReachedAtCount: number;
  shotsFired: number;
  shotsHit: number;
  breakdownTotals: {
    kills: number;
    baseKillPoints: number;
    comboBonusPoints: number;
    tierBonusesAwardedTotal: number;
    waveBonusPoints: number;
    accuracyBonusPoints: number;
  };
  perEnemy: Record<string, EnemyScoreBreakdown>;
  lastKillAtMs?: number;
  lastResetReason?: 'EXPIRED' | 'PLAYER_HIT' | 'MANUAL';
};

export const createInitialScoreState = (): ScoreState => ({
  score: 0,
  comboCount: 0,
  comboExpiresAtMs: null,
  currentTierIndex: null,
  lastTierReachedAtCount: 0,
  shotsFired: 0,
  shotsHit: 0,
  breakdownTotals: {
    kills: 0,
    baseKillPoints: 0,
    comboBonusPoints: 0,
    tierBonusesAwardedTotal: 0,
    waveBonusPoints: 0,
    accuracyBonusPoints: 0,
  },
  perEnemy: {},
});
