export const PoolLimits = {
  playerBullets: { initial: 32, max: 128 },
  enemyBullets: { initial: 32, max: 128 },
  explosions: { initial: 16, max: 64 },
  particles: { initial: 8, max: 32 },
} as const;
