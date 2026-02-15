import type { RunState } from './RunState';

export const RUN_EVENT = {
  STATE_CHANGED: 'run.stateChanged',
  READY: 'run.ready',
  COUNTDOWN_TICK: 'run.countdownTick',
  PLAYING: 'run.playing',
  PLAYER_RESPAWN: 'run.playerRespawn',
  WAVE_CLEAR: 'run.waveClear',
  LEVEL_COMPLETE: 'run.levelComplete',
  ENDING: 'run.ending',
  SUBMITTING: 'run.submitting',
  RESULTS: 'run.results',
  ERROR: 'run.error',
  REQUEST_BOOT_COMPLETE: 'run.requestBootComplete',
  REQUEST_START: 'run.requestStart',
  REQUEST_RESPAWN: 'run.requestRespawn',
  REQUEST_WAVE_CLEAR: 'run.requestWaveClear',
  REQUEST_LEVEL_COMPLETE: 'run.requestLevelComplete',
  REQUEST_END: 'run.requestEnd',
  REQUEST_SUBMISSION_COMPLETE: 'run.requestSubmissionComplete',
  LEVEL_WAVE_CLEARED: 'level.waveCleared',
  PLAYER_SHOT_FIRED: 'score.shotFired',
  PLAYER_SHOT_HIT: 'score.shotHit',
  ENEMY_KILLED: 'score.enemyKilled',
  PLAYER_HIT: 'score.playerHit',
  SCORE_CHANGED: 'score.changed',
  SCORE_TIER_ENTERED: 'score.tierEntered',
  SCORE_COMBO_RESET: 'score.comboReset',
  PLAYER_LIVES_CHANGED: 'player.livesChanged',
} as const;

export type TransitionReason =
  | 'boot_complete'
  | 'start_requested'
  | 'countdown_complete'
  | 'player_died'
  | 'respawn_complete'
  | 'wave_clear'
  | 'wave_clear_complete'
  | 'level_complete'
  | 'level_complete_complete'
  | 'run_end_requested'
  | 'run_end_complete'
  | 'submission_complete'
  | 'error';

export type RunEventMap = {
  [RUN_EVENT.STATE_CHANGED]: {
    from: RunState;
    to: RunState;
    reason: TransitionReason;
  };
  [RUN_EVENT.READY]: undefined;
  [RUN_EVENT.COUNTDOWN_TICK]: { remainingMs: number };
  [RUN_EVENT.PLAYING]: undefined;
  [RUN_EVENT.PLAYER_RESPAWN]: undefined;
  [RUN_EVENT.WAVE_CLEAR]: undefined;
  [RUN_EVENT.LEVEL_COMPLETE]: undefined;
  [RUN_EVENT.ENDING]: undefined;
  [RUN_EVENT.SUBMITTING]: undefined;
  [RUN_EVENT.RESULTS]: undefined;
  [RUN_EVENT.ERROR]: { message: string };
  [RUN_EVENT.REQUEST_BOOT_COMPLETE]: undefined;
  [RUN_EVENT.REQUEST_START]: undefined;
  [RUN_EVENT.REQUEST_RESPAWN]: undefined;
  [RUN_EVENT.REQUEST_WAVE_CLEAR]: undefined;
  [RUN_EVENT.REQUEST_LEVEL_COMPLETE]: undefined;
  [RUN_EVENT.REQUEST_END]: { reason: string };
  [RUN_EVENT.REQUEST_SUBMISSION_COMPLETE]: undefined;
  [RUN_EVENT.LEVEL_WAVE_CLEARED]: {
    levelNumber: number;
    waveIndex: number;
    reason: 'ALL_ENEMIES_DEAD' | 'ENRAGE_TIMEOUT';
    nowMs: number;
    livesRemaining: number;
  };
  [RUN_EVENT.PLAYER_SHOT_FIRED]: { nowMs: number };
  [RUN_EVENT.PLAYER_SHOT_HIT]: { nowMs: number };
  [RUN_EVENT.ENEMY_KILLED]: {
    enemyId: string;
    nowMs: number;
    x?: number;
    y?: number;
  };
  [RUN_EVENT.PLAYER_HIT]: { nowMs: number };
  [RUN_EVENT.SCORE_CHANGED]: {
    score: number;
    comboCount: number;
    maxComboCount: number;
    tierIndex: number | null;
    nowMs: number;
  };
  [RUN_EVENT.SCORE_TIER_ENTERED]: {
    tierIndex: number;
    minCount: number;
    multiplier: number;
    tierBonus: number;
    comboCount: number;
    nowMs: number;
  };
  [RUN_EVENT.SCORE_COMBO_RESET]: {
    reason: 'EXPIRED' | 'PLAYER_HIT';
    nowMs: number;
  };
  [RUN_EVENT.PLAYER_LIVES_CHANGED]: {
    livesRemaining: number;
    nowMs: number;
  };
};
