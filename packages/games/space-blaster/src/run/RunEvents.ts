import type { RunState } from './RunState';

export const RUN_EVENT = {
  STATE_CHANGED: 'run.stateChanged',
  READY: 'run.ready',
  COUNTDOWN_TICK: 'run.countdownTick',
  PLAYING: 'run.playing',
  PLAYER_RESPAWN: 'run.playerRespawn',
  WAVE_CLEAR: 'run.waveClear',
  ENDING: 'run.ending',
  RESULTS: 'run.results',
  ERROR: 'run.error',
  REQUEST_BOOT_COMPLETE: 'run.requestBootComplete',
  REQUEST_START: 'run.requestStart',
  REQUEST_RESPAWN: 'run.requestRespawn',
  REQUEST_WAVE_CLEAR: 'run.requestWaveClear',
  REQUEST_END: 'run.requestEnd',
} as const;

export type TransitionReason =
  | 'boot_complete'
  | 'start_requested'
  | 'countdown_complete'
  | 'player_died'
  | 'respawn_complete'
  | 'wave_clear'
  | 'wave_clear_complete'
  | 'run_end_requested'
  | 'run_end_complete'
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
  [RUN_EVENT.ENDING]: undefined;
  [RUN_EVENT.RESULTS]: undefined;
  [RUN_EVENT.ERROR]: { message: string };
  [RUN_EVENT.REQUEST_BOOT_COMPLETE]: undefined;
  [RUN_EVENT.REQUEST_START]: undefined;
  [RUN_EVENT.REQUEST_RESPAWN]: undefined;
  [RUN_EVENT.REQUEST_WAVE_CLEAR]: undefined;
  [RUN_EVENT.REQUEST_END]: { reason: string };
};
