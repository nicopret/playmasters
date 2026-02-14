import { RunState } from './RunState';

export const allowedTransitions: Record<RunState, ReadonlySet<RunState>> = {
  [RunState.BOOT]: new Set([RunState.READY, RunState.ERROR]),
  [RunState.READY]: new Set([RunState.COUNTDOWN, RunState.ERROR]),
  [RunState.COUNTDOWN]: new Set([
    RunState.PLAYING,
    RunState.RUN_ENDING,
    RunState.ERROR,
  ]),
  [RunState.PLAYING]: new Set([
    RunState.PLAYER_RESPAWN,
    RunState.WAVE_CLEAR,
    RunState.LEVEL_COMPLETE,
    RunState.RUN_ENDING,
    RunState.ERROR,
  ]),
  [RunState.PLAYER_RESPAWN]: new Set([
    RunState.COUNTDOWN,
    RunState.RUN_ENDING,
    RunState.ERROR,
  ]),
  [RunState.WAVE_CLEAR]: new Set([
    RunState.COUNTDOWN,
    RunState.RUN_ENDING,
    RunState.ERROR,
  ]),
  [RunState.LEVEL_COMPLETE]: new Set([
    RunState.COUNTDOWN,
    RunState.RUN_ENDING,
    RunState.ERROR,
  ]),
  [RunState.RUN_ENDING]: new Set([RunState.RESULTS, RunState.ERROR]),
  [RunState.RESULTS]: new Set([RunState.COUNTDOWN, RunState.ERROR]),
  [RunState.ERROR]: new Set([]),
};

export const isAllowedTransition = (from: RunState, to: RunState): boolean =>
  allowedTransitions[from].has(to);
