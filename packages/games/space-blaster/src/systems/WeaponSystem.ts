import type * as Phaser from 'phaser';
import { PoolLimits } from '../perf/poolLimits';
import { ProjectilePool } from '../projectiles/ProjectilePool';
import { FireCooldown } from './fire-cooldown';

type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

export type WeaponSystemConfig = {
  fireCooldownMs: number;
  projectileSpeed: number;
  poolSize?: number;
  poolInitialSize?: number;
  poolMaxSize?: number;
  projectileWidth?: number;
  projectileHeight?: number;
  projectileColor?: number;
};

export class WeaponSystem {
  private readonly group: Phaser.Physics.Arcade.Group;
  private readonly pool: ProjectilePool<Phaser.GameObjects.Rectangle>;
  private readonly cooldown: FireCooldown;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly getBounds: () => Bounds,
    config: WeaponSystemConfig,
  ) {
    this.cooldown = new FireCooldown(config.fireCooldownMs);
    this.group = this.scene.physics.add.group({ runChildUpdate: false });
    const defaultLimits = PoolLimits.playerBullets;
    const poolInitialSize =
      config.poolInitialSize ?? config.poolSize ?? defaultLimits.initial;
    const poolMaxSize = config.poolMaxSize ?? defaultLimits.max;

    this.pool = new ProjectilePool({
      initial: poolInitialSize,
      max: poolMaxSize,
      owner: config.projectileColor === 0xe94b5a ? 'enemy' : 'player',
      create: () => {
        const projectile = this.scene.add.rectangle(
          -1000,
          -1000,
          config.projectileWidth ?? 6,
          config.projectileHeight ?? 16,
          config.projectileColor ?? 0xf9d65c,
        );
        this.scene.physics.add.existing(projectile);
        const body = projectile.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false);
        body.enable = false;
        projectile.setVisible(false);
        projectile.setActive(false);
        this.group.add(projectile);
        return projectile;
      },
    });
    this.projectileSpeed = config.projectileSpeed;
  }

  private projectileSpeed: number;

  get projectileGroup(): Phaser.Physics.Arcade.Group {
    return this.group;
  }

  update(simDtMs: number): void {
    this.cooldown.update(simDtMs);
    const bounds = this.getBounds();
    for (const projectile of this.pool.activeItems()) {
      if (
        projectile.x < bounds.minX - 32 ||
        projectile.x > bounds.maxX + 32 ||
        projectile.y < bounds.minY - 32 ||
        projectile.y > bounds.maxY + 32
      ) {
        this.releaseProjectile(projectile);
      }
    }
  }

  tryFire(originX: number, originY: number, directionY = -1): boolean {
    if (!this.cooldown.canFire()) return false;
    const projectile = this.pool.spawnBullet({
      x: originX,
      y: originY,
      velocityY: directionY * this.projectileSpeed,
    });
    if (!projectile) return false;
    if (!this.cooldown.consume()) {
      this.pool.releaseBullet(projectile);
      return false;
    }

    return true;
  }

  releaseProjectile(gameObject: Phaser.GameObjects.GameObject): void {
    const projectile = gameObject as Phaser.GameObjects.Rectangle;
    this.pool.releaseBullet(projectile);
  }

  clear(): void {
    this.pool.resetAll();
  }

  getPoolStats(): { free: number; active: number; total: number; max: number } {
    return this.pool.stats();
  }
}
