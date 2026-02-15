import { RunState } from '../run';
import { isRunStartTransition } from './run-start-gating';

describe('isRunStartTransition', () => {
  it('returns true for READY -> COUNTDOWN', () => {
    expect(isRunStartTransition(RunState.READY, RunState.COUNTDOWN)).toBe(true);
  });

  it('returns false for non-COUNTDOWN destinations', () => {
    expect(isRunStartTransition(RunState.READY, RunState.PLAYING)).toBe(false);
    expect(isRunStartTransition(RunState.PLAYING, RunState.RUN_ENDING)).toBe(
      false,
    );
  });

  it('returns false for non-run-start countdown transitions', () => {
    expect(
      isRunStartTransition(RunState.PLAYER_RESPAWN, RunState.COUNTDOWN),
    ).toBe(false);
    expect(isRunStartTransition(RunState.WAVE_CLEAR, RunState.COUNTDOWN)).toBe(
      false,
    );
    expect(
      isRunStartTransition(RunState.LEVEL_COMPLETE, RunState.COUNTDOWN),
    ).toBe(false);
  });

  it('allows RESULTS -> COUNTDOWN as the equivalent new-run boundary', () => {
    expect(isRunStartTransition(RunState.RESULTS, RunState.COUNTDOWN)).toBe(
      true,
    );
  });
});
