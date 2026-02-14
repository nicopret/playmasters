import { RunState } from './RunState';
import { allowedTransitions, isAllowedTransition } from './RunTransitions';

describe('RunTransitions', () => {
  it('defines transition entries for every state', () => {
    const states = Object.values(RunState);
    expect(Object.keys(allowedTransitions).sort()).toEqual(states.sort());
  });

  it('allows required lifecycle transitions', () => {
    expect(isAllowedTransition(RunState.BOOT, RunState.READY)).toBe(true);
    expect(isAllowedTransition(RunState.READY, RunState.COUNTDOWN)).toBe(true);
    expect(isAllowedTransition(RunState.COUNTDOWN, RunState.PLAYING)).toBe(
      true,
    );
    expect(isAllowedTransition(RunState.PLAYING, RunState.PLAYER_RESPAWN)).toBe(
      true,
    );
    expect(isAllowedTransition(RunState.PLAYING, RunState.WAVE_CLEAR)).toBe(
      true,
    );
    expect(isAllowedTransition(RunState.PLAYING, RunState.LEVEL_COMPLETE)).toBe(
      true,
    );
    expect(
      isAllowedTransition(RunState.PLAYER_RESPAWN, RunState.COUNTDOWN),
    ).toBe(true);
    expect(isAllowedTransition(RunState.WAVE_CLEAR, RunState.COUNTDOWN)).toBe(
      true,
    );
    expect(
      isAllowedTransition(RunState.LEVEL_COMPLETE, RunState.COUNTDOWN),
    ).toBe(true);
    expect(isAllowedTransition(RunState.PLAYING, RunState.RUN_ENDING)).toBe(
      true,
    );
    expect(isAllowedTransition(RunState.RUN_ENDING, RunState.RESULTS)).toBe(
      true,
    );
  });

  it('rejects illegal transitions', () => {
    expect(isAllowedTransition(RunState.BOOT, RunState.PLAYING)).toBe(false);
    expect(isAllowedTransition(RunState.READY, RunState.RUN_ENDING)).toBe(
      false,
    );
    expect(isAllowedTransition(RunState.RESULTS, RunState.PLAYING)).toBe(false);
  });
});
