import {
  assertAtBaseline,
  captureBaseline,
  type PoolMetricsSnapshot,
} from './poolLeakChecks';

const createMetrics = (): PoolMetricsSnapshot => ({
  playerBullets: { active: 0, free: 128, total: 128, max: 128 },
  enemyBullets: { active: 0, free: 128, total: 128, max: 128 },
  explosions: { active: 0, free: 16, total: 16, max: 64 },
  particles: { inUse: 0, max: 32, activeBursts: 0 },
});

describe('poolLeakChecks', () => {
  it('captures and validates baseline without issues', () => {
    const baseline = captureBaseline(createMetrics());
    const report = assertAtBaseline(createMetrics(), baseline);
    expect(report.atBaseline).toBe(true);
    expect(report.issues).toEqual([]);
  });

  it('reports stranded active objects after reset', () => {
    const baseline = captureBaseline(createMetrics());
    const current = createMetrics();
    current.playerBullets.active = 2;
    current.playerBullets.free = 126;
    current.particles.inUse = 3;
    current.particles.activeBursts = 1;

    const report = assertAtBaseline(current, baseline);
    expect(report.atBaseline).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        'playerBullets active=2 expected=0',
        'playerBullets free=126 expected=128',
        'particles inUse=3 expected=0',
        'particles activeBursts=1 expected=0',
      ]),
    );
  });
});
