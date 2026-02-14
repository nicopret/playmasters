import { canPlayerFire, isSimulationRunning } from './player-action-gates';

describe('player action gates', () => {
  it('runs simulation only in playing', () => {
    expect(isSimulationRunning('idle')).toBe(false);
    expect(isSimulationRunning('player_respawn')).toBe(false);
    expect(isSimulationRunning('run_ending')).toBe(false);
    expect(isSimulationRunning('gameover')).toBe(false);
    expect(isSimulationRunning('playing')).toBe(true);
  });

  it('blocks firing while respawning and while invulnerable', () => {
    expect(canPlayerFire('player_respawn', false)).toBe(false);
    expect(canPlayerFire('playing', true)).toBe(false);
    expect(canPlayerFire('playing', false)).toBe(true);
  });
});
