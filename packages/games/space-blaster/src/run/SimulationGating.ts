import { RunState } from './RunState';

export const isSimulationRunning = (
  state: RunState,
  overlayBlockingGameplay: boolean,
): boolean => state === RunState.PLAYING && !overlayBlockingGameplay;

type OrchestrateFrameParams = {
  deltaMs: number;
  overlayBlockingGameplay: boolean;
  getState: () => RunState;
  advanceRunStateMachine: (dtMs: number) => void;
  advanceSimulation: (dtMs: number) => void;
  setPhysicsPaused: (paused: boolean) => void;
};

export const orchestrateRunFrame = ({
  deltaMs,
  overlayBlockingGameplay,
  getState,
  advanceRunStateMachine,
  advanceSimulation,
  setPhysicsPaused,
}: OrchestrateFrameParams): void => {
  const runDtMs = overlayBlockingGameplay ? 0 : deltaMs;
  advanceRunStateMachine(runDtMs);

  const simulationRunning = isSimulationRunning(
    getState(),
    overlayBlockingGameplay,
  );
  setPhysicsPaused(!simulationRunning);
  if (!simulationRunning) return;
  advanceSimulation(deltaMs);
};
