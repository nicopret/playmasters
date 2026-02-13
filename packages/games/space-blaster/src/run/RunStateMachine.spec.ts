import { RUN_EVENT } from './RunEvents';
import { RunEventBus } from './RunEventBus';
import { RunState } from './RunState';
import { RunStateMachine } from './RunStateMachine';

const createMachine = (bus: RunEventBus) =>
  new RunStateMachine(
    bus,
    { countdownMs: 1000, respawnDelayMs: 500, runEndingDelayMs: 300 },
    {},
  );

describe('RunStateMachine', () => {
  it('runs BOOT -> READY -> COUNTDOWN -> PLAYING deterministically', () => {
    const bus = new RunEventBus();
    const machine = createMachine(bus);
    const sequence: string[] = [];

    bus.on(RUN_EVENT.STATE_CHANGED, ({ from, to }) => {
      sequence.push(`${from}->${to}`);
    });

    machine.requestBootComplete();
    machine.update(0);
    expect(machine.state).toBe(RunState.READY);

    machine.requestStart();
    machine.update(0);
    expect(machine.state).toBe(RunState.COUNTDOWN);

    machine.update(999);
    expect(machine.state).toBe(RunState.COUNTDOWN);
    machine.update(1);
    expect(machine.state).toBe(RunState.PLAYING);

    expect(sequence).toEqual([
      'BOOT->READY',
      'READY->COUNTDOWN',
      'COUNTDOWN->PLAYING',
    ]);
  });

  it('reaches PLAYER_RESPAWN then returns to PLAYING through COUNTDOWN', () => {
    const bus = new RunEventBus();
    const machine = createMachine(bus);

    machine.requestBootComplete();
    machine.update(0);
    machine.requestStart();
    machine.update(0);
    machine.update(1000);
    expect(machine.state).toBe(RunState.PLAYING);

    machine.requestRespawn();
    machine.update(0);
    expect(machine.state).toBe(RunState.PLAYER_RESPAWN);

    machine.update(500);
    expect(machine.state).toBe(RunState.COUNTDOWN);
    machine.update(1000);
    expect(machine.state).toBe(RunState.PLAYING);
  });

  it('reaches RUN_ENDING and terminates in RUN_ENDED', () => {
    const bus = new RunEventBus();
    const machine = createMachine(bus);

    machine.requestBootComplete();
    machine.update(0);
    machine.requestStart();
    machine.update(0);
    machine.update(1000);
    expect(machine.state).toBe(RunState.PLAYING);

    machine.requestEndRun('manual_stop');
    machine.update(0);
    expect(machine.state).toBe(RunState.RUN_ENDING);

    machine.update(300);
    expect(machine.state).toBe(RunState.RUN_ENDED);
  });

  it('throws on illegal transitions', () => {
    const bus = new RunEventBus();
    const machine = createMachine(bus);
    const errors: string[] = [];
    bus.on(RUN_EVENT.ERROR, ({ message }) => errors.push(message));

    expect(() => {
      machine.requestBootComplete();
      machine.update(0);
      machine.requestEndRun('illegal_from_ready');
      machine.update(0);
      (
        machine as unknown as {
          transition: (to: RunState, reason: string) => void;
        }
      ).transition(RunState.PLAYING, 'start_requested');
    }).toThrow('Illegal run state transition: READY -> PLAYING');
    expect(errors).toContain('Illegal run state transition: READY -> PLAYING');
  });
});
