import { RUN_EVENT } from './RunEvents';
import { RunEventBus } from './RunEventBus';
import { RunState } from './RunState';
import { RunStateMachine } from './RunStateMachine';

const createMachine = (bus: RunEventBus) =>
  new RunStateMachine(
    bus,
    {
      countdownMs: 1000,
      respawnDelayMs: 500,
      waveClearMs: 250,
      levelCompleteMs: 400,
      runEndingDelayMs: 300,
    },
    {},
  );

describe('RunStateMachine', () => {
  it('runs BOOT -> READY -> COUNTDOWN -> PLAYING -> RUN_ENDING -> RESULTS deterministically', () => {
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
    machine.requestEndRun('normal_finish');
    machine.update(0);
    expect(machine.state).toBe(RunState.RUN_ENDING);
    machine.update(300);
    expect(machine.state).toBe(RunState.RESULTS);

    expect(sequence).toEqual([
      'BOOT->READY',
      'READY->COUNTDOWN',
      'COUNTDOWN->PLAYING',
      'PLAYING->RUN_ENDING',
      'RUN_ENDING->RESULTS',
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

  it('reaches WAVE_CLEAR and loops back to PLAYING', () => {
    const bus = new RunEventBus();
    const machine = createMachine(bus);

    machine.requestBootComplete();
    machine.update(0);
    machine.requestStart();
    machine.update(0);
    machine.update(1000);
    expect(machine.state).toBe(RunState.PLAYING);

    machine.requestWaveClear();
    machine.update(0);
    expect(machine.state).toBe(RunState.WAVE_CLEAR);

    machine.update(250);
    expect(machine.state).toBe(RunState.COUNTDOWN);
    machine.update(1000);
    expect(machine.state).toBe(RunState.PLAYING);
  });

  it('reaches LEVEL_COMPLETE and loops back to PLAYING', () => {
    const bus = new RunEventBus();
    const machine = createMachine(bus);

    machine.requestBootComplete();
    machine.update(0);
    machine.requestStart();
    machine.update(0);
    machine.update(1000);
    expect(machine.state).toBe(RunState.PLAYING);

    machine.requestLevelComplete();
    machine.update(0);
    expect(machine.state).toBe(RunState.LEVEL_COMPLETE);

    machine.update(400);
    expect(machine.state).toBe(RunState.COUNTDOWN);
    machine.update(1000);
    expect(machine.state).toBe(RunState.PLAYING);
  });

  it('reaches RUN_ENDING and terminates in RESULTS', () => {
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
    expect(machine.state).toBe(RunState.RESULTS);
  });

  it('always reaches RESULTS even when result side-effects fail', () => {
    const bus = new RunEventBus();
    const machine = new RunStateMachine(
      bus,
      {
        countdownMs: 1000,
        respawnDelayMs: 500,
        waveClearMs: 250,
        levelCompleteMs: 400,
        runEndingDelayMs: 300,
      },
      {
        onEnterState: (state) => {
          if (state === RunState.RESULTS) {
            throw new Error('submission failed');
          }
        },
      },
    );

    machine.requestBootComplete();
    machine.update(0);
    machine.requestStart();
    machine.update(0);
    machine.update(1000);
    machine.requestEndRun('manual_stop');
    machine.update(0);

    expect(() => machine.update(300)).toThrow('submission failed');
    expect(machine.state).toBe(RunState.RESULTS);
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
