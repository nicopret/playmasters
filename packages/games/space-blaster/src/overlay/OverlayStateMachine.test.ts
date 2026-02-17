import { OverlayState, OverlayStateMachine } from './OverlayStateMachine';

describe('OverlayStateMachine', () => {
  it('allows legal transitions for pause/settings/results layers', () => {
    const machine = new OverlayStateMachine();

    expect(machine.getState()).toBe(OverlayState.NONE);
    expect(machine.getBlocksGameplay()).toBe(false);

    machine.dispatch('OPEN_PAUSE');
    expect(machine.getState()).toBe(OverlayState.PAUSED);
    expect(machine.getBlocksGameplay()).toBe(true);

    machine.dispatch('OPEN_SETTINGS');
    expect(machine.getState()).toBe(OverlayState.SETTINGS);
    expect(machine.getBlocksGameplay()).toBe(true);

    machine.dispatch('CLOSE_SETTINGS');
    expect(machine.getState()).toBe(OverlayState.PAUSED);

    machine.dispatch('CLOSE_PAUSE');
    expect(machine.getState()).toBe(OverlayState.NONE);

    machine.dispatch('SHOW_RESULTS');
    expect(machine.getState()).toBe(OverlayState.RESULTS);
    expect(machine.getBlocksGameplay()).toBe(true);

    const outcome = machine.dispatch('RESTART_REQUESTED');
    expect(outcome).toEqual({ restartRequested: true });
    expect(machine.getState()).toBe(OverlayState.NONE);
  });

  it('rejects illegal transitions', () => {
    const machine = new OverlayStateMachine();

    expect(() => machine.dispatch('OPEN_SETTINGS')).toThrow(
      'Illegal overlay transition: NONE -> SETTINGS',
    );

    machine.dispatch('OPEN_PAUSE');
    expect(() => machine.dispatch('SHOW_RESULTS')).toThrow(
      'Illegal overlay transition: PAUSED -> RESULTS',
    );

    machine.dispatch('CLOSE_PAUSE');
    expect(() => machine.dispatch('RESTART_REQUESTED')).toThrow(
      'Illegal overlay action: RESTART_REQUESTED from NONE',
    );
  });
});
