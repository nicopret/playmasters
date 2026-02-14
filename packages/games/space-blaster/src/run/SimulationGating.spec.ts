import { RunState } from './RunState';
import { isSimulationRunning, orchestrateRunFrame } from './SimulationGating';

describe('SimulationGating', () => {
  it('reports simulation running only when PLAYING and not blocked', () => {
    expect(isSimulationRunning(RunState.PLAYING, false)).toBe(true);
    expect(isSimulationRunning(RunState.PLAYING, true)).toBe(false);
    expect(isSimulationRunning(RunState.READY, false)).toBe(false);
    expect(isSimulationRunning(RunState.COUNTDOWN, false)).toBe(false);
    expect(isSimulationRunning(RunState.RUN_ENDING, false)).toBe(false);
  });

  it('does not advance simulation when not PLAYING', () => {
    const advanceRunStateMachine = jest.fn();
    const advanceSimulation = jest.fn();
    const setPhysicsPaused = jest.fn();

    orchestrateRunFrame({
      deltaMs: 16,
      overlayBlockingGameplay: false,
      getState: () => RunState.READY,
      advanceRunStateMachine,
      advanceSimulation,
      setPhysicsPaused,
    });

    expect(advanceRunStateMachine).toHaveBeenCalledWith(16);
    expect(advanceSimulation).not.toHaveBeenCalled();
    expect(setPhysicsPaused).toHaveBeenCalledWith(true);
  });

  it('freezes both machine and simulation clocks while overlay is blocking', () => {
    const runDtCalls: number[] = [];
    const simDtCalls: number[] = [];
    const setPhysicsPaused = jest.fn();

    for (let i = 0; i < 3; i += 1) {
      orchestrateRunFrame({
        deltaMs: 33,
        overlayBlockingGameplay: true,
        getState: () => RunState.PLAYING,
        advanceRunStateMachine: (dtMs) => runDtCalls.push(dtMs),
        advanceSimulation: (dtMs) => simDtCalls.push(dtMs),
        setPhysicsPaused,
      });
    }

    expect(runDtCalls).toEqual([0, 0, 0]);
    expect(simDtCalls).toEqual([]);
    expect(setPhysicsPaused).toHaveBeenCalledWith(true);
  });

  it('advances simulation only when machine is in PLAYING and not blocked', () => {
    const advanceRunStateMachine = jest.fn();
    const advanceSimulation = jest.fn();
    const setPhysicsPaused = jest.fn();

    orchestrateRunFrame({
      deltaMs: 20,
      overlayBlockingGameplay: false,
      getState: () => RunState.PLAYING,
      advanceRunStateMachine,
      advanceSimulation,
      setPhysicsPaused,
    });

    expect(advanceRunStateMachine).toHaveBeenCalledWith(20);
    expect(advanceSimulation).toHaveBeenCalledWith(20);
    expect(setPhysicsPaused).toHaveBeenCalledWith(false);
  });
});
