import type * as Phaser from 'phaser';
import { FireCooldown } from './fire-cooldown';
import { FixedObjectPool } from './object-pool';

type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

export type WeaponSystemConfig = {
  fireCooldownMs: number;
  projectileSpeed: number;
  poolSize: number;
  projectileWidth?: number;
  projectileHeight?: number;
  projectileColor?: number;
};

export class WeaponSystem {
  private readonly group: Phaser.Physics.Arcade.Group;
  private readonly pool: FixedObjectPool<Phaser.GameObjects.Rectangle>;
  private readonly cooldown: FireCooldown;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly getBounds: () => Bounds,
    config: WeaponSystemConfig,
  ) {
    this.cooldown = new FireCooldown(config.fireCooldownMs);
    this.group = this.scene.physics.add.group({ runChildUpdate: false });
    this.pool = FixedObjectPool.create(config.poolSize, () => {
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
    const projectile = this.pool.acquire();
    if (!projectile) return false;
    if (!this.cooldown.consume()) {
      this.pool.release(projectile);
      return false;
    }

    const body = projectile.body as Phaser.Physics.Arcade.Body;
    projectile.setActive(true);
    projectile.setVisible(true);
    projectile.setPosition(originX, originY);
    body.enable = true;
    body.reset(originX, originY);
    body.setVelocityY(directionY * this.projectileSpeed);
    return true;
  }

  releaseProjectile(gameObject: Phaser.GameObjects.GameObject): void {
    const projectile = gameObject as Phaser.GameObjects.Rectangle;
    const body = projectile.body as Phaser.Physics.Arcade.Body;
    body.stop();
    body.enable = false;
    projectile.setActive(false);
    projectile.setVisible(false);
    projectile.setPosition(-1000, -1000);
    this.pool.release(projectile);
  }

  clear(): void {
    for (const projectile of this.pool.activeItems()) {
      this.releaseProjectile(projectile);
    }
  }
}
