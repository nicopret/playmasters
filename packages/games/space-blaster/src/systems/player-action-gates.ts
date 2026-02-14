export type PlayerRunPhase =
  | 'idle'
  | 'playing'
  | 'player_respawn'
  | 'run_ending'
  | 'gameover';

export const isSimulationRunning = (phase: PlayerRunPhase): boolean =>
  phase === 'playing';

export const canPlayerFire = (
  phase: PlayerRunPhase,
  invulnerable: boolean,
): boolean => isSimulationRunning(phase) && !invulnerable;
