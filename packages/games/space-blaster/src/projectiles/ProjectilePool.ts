import { ObjectPool } from '../perf/ObjectPool';

export type ProjectileOwner = 'player' | 'enemy';

export const PROJECTILE_RENDER_DEPTH = 20;

export type ProjectileBodyLike = {
  enable?: boolean;
  stop?: () => void;
  reset?: (x: number, y: number) => void;
  setVelocityY?: (velocityY: number) => void;
};

export type ProjectileLike = {
  body?: unknown;
  active: boolean;
  visible: boolean;
  x: number;
  y: number;
  alpha: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  setActive: (active: boolean) => unknown;
  setVisible: (visible: boolean) => unknown;
  setPosition: (x: number, y: number) => unknown;
  setAlpha: (alpha: number) => unknown;
  setScale: (x: number, y?: number) => unknown;
  setRotation: (rotation: number) => unknown;
  setDepth: (depth: number) => unknown;
  owner?: ProjectileOwner;
};

export const resetBulletOnAcquire = (
  projectile: ProjectileLike,
  args: {
    x: number;
    y: number;
    velocityY: number;
    depth?: number;
    owner: ProjectileOwner;
  },
): void => {
  projectile.owner = args.owner;
  projectile.setDepth(args.depth ?? PROJECTILE_RENDER_DEPTH);
  projectile.setAlpha(1);
  projectile.setScale(1);
  projectile.setRotation(0);
  projectile.setPosition(args.x, args.y);
  projectile.setActive(true);
  projectile.setVisible(true);

  const body = projectile.body as ProjectileBodyLike | null | undefined;
  if (!body) {
    return;
  }
  if (typeof body.enable === 'boolean') {
    body.enable = true;
  }
  body.reset?.(args.x, args.y);
  body.setVelocityY?.(args.velocityY);
};

export const resetBulletOnRelease = (
  projectile: ProjectileLike,
  offscreen = { x: -1000, y: -1000 },
): void => {
  const body = projectile.body as ProjectileBodyLike | null | undefined;
  if (body) {
    body.stop?.();
    if (typeof body.enable === 'boolean') {
      body.enable = false;
    }
  }
  projectile.setRotation(0);
  projectile.setScale(1);
  projectile.setAlpha(1);
  projectile.setActive(false);
  projectile.setVisible(false);
  projectile.setPosition(offscreen.x, offscreen.y);
};

export type ProjectilePoolOptions<T extends ProjectileLike> = {
  initial: number;
  max: number;
  owner: ProjectileOwner;
  create: () => T;
  depth?: number;
};

export class ProjectilePool<T extends ProjectileLike> {
  private readonly owner: ProjectileOwner;
  private readonly depth: number;
  private readonly pool: ObjectPool<T>;

  constructor(options: ProjectilePoolOptions<T>) {
    this.owner = options.owner;
    this.depth = options.depth ?? PROJECTILE_RENDER_DEPTH;
    this.pool = new ObjectPool<T>({
      initial: options.initial,
      max: options.max,
      create: options.create,
      onRelease: (projectile) => resetBulletOnRelease(projectile),
    });
  }

  spawnBullet(args: { x: number; y: number; velocityY: number }): T | null {
    const projectile = this.pool.acquire();
    if (!projectile) {
      return null;
    }
    resetBulletOnAcquire(projectile, {
      x: args.x,
      y: args.y,
      velocityY: args.velocityY,
      depth: this.depth,
      owner: this.owner,
    });
    return projectile;
  }

  releaseBullet(projectile: T): void {
    this.pool.release(projectile);
  }

  resetAll(): void {
    this.pool.resetAll();
  }

  activeItems(): readonly T[] {
    return this.pool.activeItems();
  }

  stats(): { free: number; active: number; total: number; max: number } {
    return this.pool.stats();
  }
}
