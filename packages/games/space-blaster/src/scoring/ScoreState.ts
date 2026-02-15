export type EnemyScoreBreakdown = {
  kills: number;
  points: number;
};

export type ScoreEvent =
  | { type: 'SHOT_FIRED'; atMs: number }
  | {
      type: 'KILL';
      atMs: number;
      enemyId: string;
      baseKillPoints: number;
      comboExtra: number;
      tierBonus: number;
      comboCount: number;
      tierIndex: number | null;
      levelMultiplier: number;
    }
  | {
      type: 'TIER_ENTER';
      atMs: number;
      tierIndex: number;
      minCount: number;
      tierBonus: number;
    }
  | { type: 'COMBO_RESET'; atMs: number; reason: 'EXPIRED' | 'PLAYER_HIT' };

export type ScoreState = {
  score: number;
  finalized: boolean;
  comboCount: number;
  comboExpiresAtMs: number | null;
  currentTierIndex: number | null;
  lastTierReachedAtCount: number;
  shotsFired: number;
  shotsHit: number;
  breakdownTotals: {
    kills: number;
    killPoints: number;
    comboExtra: number;
    tierBonuses: number;
    waveClearBonuses: number;
    accuracyBonus: number;
  };
  perEnemy: Record<string, EnemyScoreBreakdown>;
  eventLog: ScoreEvent[];
  lastKillAtMs?: number;
  lastResetReason?: 'EXPIRED' | 'PLAYER_HIT' | 'MANUAL';
};

export const createInitialScoreState = (): ScoreState => ({
  score: 0,
  finalized: false,
  comboCount: 0,
  comboExpiresAtMs: null,
  currentTierIndex: null,
  lastTierReachedAtCount: 0,
  shotsFired: 0,
  shotsHit: 0,
  breakdownTotals: {
    kills: 0,
    killPoints: 0,
    comboExtra: 0,
    tierBonuses: 0,
    waveClearBonuses: 0,
    accuracyBonus: 0,
  },
  perEnemy: {},
  eventLog: [],
});
