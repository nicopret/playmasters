export type PoolCounterSnapshot = {
  active: number;
  free: number;
  total: number;
  max: number;
};

export type ParticleCounterSnapshot = {
  inUse: number;
  max: number;
  activeBursts: number;
};

export type PoolMetricsSnapshot = {
  playerBullets: PoolCounterSnapshot;
  enemyBullets: PoolCounterSnapshot;
  explosions: PoolCounterSnapshot;
  particles: ParticleCounterSnapshot;
};

export type PoolBaselineSnapshot = PoolMetricsSnapshot;

export type PoolLeakReport = {
  atBaseline: boolean;
  issues: string[];
};

export const captureBaseline = (
  metrics: PoolMetricsSnapshot,
): PoolBaselineSnapshot => ({
  playerBullets: { ...metrics.playerBullets },
  enemyBullets: { ...metrics.enemyBullets },
  explosions: { ...metrics.explosions },
  particles: { ...metrics.particles },
});

const comparePool = (
  label: string,
  current: PoolCounterSnapshot,
  baseline: PoolCounterSnapshot,
  issues: string[],
): void => {
  if (current.active !== baseline.active) {
    issues.push(
      `${label} active=${current.active} expected=${baseline.active}`,
    );
  }
  if (current.free !== baseline.free) {
    issues.push(`${label} free=${current.free} expected=${baseline.free}`);
  }
  if (current.total !== baseline.total) {
    issues.push(`${label} total=${current.total} expected=${baseline.total}`);
  }
};

export const assertAtBaseline = (
  metrics: PoolMetricsSnapshot,
  baseline: PoolBaselineSnapshot,
): PoolLeakReport => {
  const issues: string[] = [];
  comparePool(
    'playerBullets',
    metrics.playerBullets,
    baseline.playerBullets,
    issues,
  );
  comparePool(
    'enemyBullets',
    metrics.enemyBullets,
    baseline.enemyBullets,
    issues,
  );
  comparePool('explosions', metrics.explosions, baseline.explosions, issues);

  if (metrics.particles.inUse !== baseline.particles.inUse) {
    issues.push(
      `particles inUse=${metrics.particles.inUse} expected=${baseline.particles.inUse}`,
    );
  }
  if (metrics.particles.activeBursts !== baseline.particles.activeBursts) {
    issues.push(
      `particles activeBursts=${metrics.particles.activeBursts} expected=${baseline.particles.activeBursts}`,
    );
  }

  return {
    atBaseline: issues.length === 0,
    issues,
  };
};
