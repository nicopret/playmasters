import { PlayerLifeSystem } from './PlayerLifeSystem';

describe('PlayerLifeSystem', () => {
  it('decrements one life once per accepted hit event', () => {
    const life = new PlayerLifeSystem(3, 1000, 50);

    const first = life.onPlayerHit();
    const second = life.onPlayerHit();
    const third = life.onPlayerHit();

    expect(first).toEqual({ kind: 'respawn', livesRemaining: 2 });
    expect(second).toEqual({ kind: 'ignored' });
    expect(third).toEqual({ kind: 'ignored' });
    expect(life.lives).toBe(2);
  });

  it('applies respawn invulnerability and only expires while sim time advances', () => {
    const life = new PlayerLifeSystem(3, 1000, 0);
    const hit = life.onPlayerHit();
    expect(hit.kind).toBe('respawn');
    expect(life.invulnerable).toBe(true);

    const duringInvuln = life.onPlayerHit();
    expect(duringInvuln).toEqual({ kind: 'ignored' });
    expect(life.lives).toBe(2);

    life.update(400);
    expect(life.invulnerable).toBe(true);
    life.update(600);
    expect(life.invulnerable).toBe(false);

    const afterInvuln = life.onPlayerHit();
    expect(afterInvuln).toEqual({ kind: 'respawn', livesRemaining: 1 });
    expect(life.lives).toBe(1);
  });

  it('returns end_run when the last life is consumed', () => {
    const life = new PlayerLifeSystem(1, 1000, 0);

    const hit = life.onPlayerHit();

    expect(hit).toEqual({ kind: 'end_run', livesRemaining: 0 });
    expect(life.lives).toBe(0);
  });
});
