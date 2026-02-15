import { RunState } from '../run';

export const isRunStartTransition = (from: RunState, to: RunState): boolean =>
  to === RunState.COUNTDOWN &&
  (from === RunState.READY || from === RunState.RESULTS);
