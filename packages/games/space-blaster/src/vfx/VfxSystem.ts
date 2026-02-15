import type * as Phaser from 'phaser';
import type { RunContext } from '../runtime';
import { RUN_EVENT, type RunEventBus } from '../run';
import { FixedObjectPool } from '../systems/object-pool';

const DEFAULT_EXPLOSION_POOL_SIZE = 24;
const DEFAULT_PARTICLE_POOL_SIZE = 96;
const DEFAULT_EXPLOSION_DURATION_MS = 260;
const DEFAULT_PARTICLE_DURATION_MS = 180;
const DEFAULT_MAX_ACTIVE_PARTICLES = 40;
const DEFAULT_MAX_PARTICLES_PER_BURST = 10;
const EXPLOSION_DEPTH = 10;
const PARTICLE_DEPTH = 9;
const EXPLOSION_ALPHA = 0.68;
const PARTICLE_ALPHA = 0.55;

type VfxSystemOptions = {
  scene: Phaser.Scene;
  ctx: RunContext;
  bus: RunEventBus;
  explosionPoolSize?: number;
  particlePoolSize?: number;
  explosionDurationMs?: number;
  particleDurationMs?: number;
  maxActiveParticles?: number;
  maxParticlesPerBurst?: number;
  enableSubtleCameraShake?: boolean;
};

type ActiveExplosion = {
  sprite: Phaser.GameObjects.Arc;
  startedAtMs: number;
  endsAtMs: number;
};

type ActiveParticle = {
  sprite: Phaser.GameObjects.Arc;
  velocityX: number;
  velocityY: number;
  startedAtMs: number;
  endsAtMs: number;
};

const clampNonNegativeInt = (value: number, fallback: number): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
};

export const computeParticleSpawnCount = (args: {
  requested: number;
  maxParticlesPerBurst: number;
  maxActiveParticles: number;
  activeParticles: number;
}): number => {
  const requested = clampNonNegativeInt(args.requested, 0);
  const maxPerBurst = clampNonNegativeInt(args.maxParticlesPerBurst, 0);
  const maxActive = clampNonNegativeInt(args.maxActiveParticles, 0);
  const active = clampNonNegativeInt(args.activeParticles, 0);
  const available = Math.max(0, maxActive - active);
  return Math.max(0, Math.min(requested, maxPerBurst, available));
};

export class VfxSystem {
  private readonly scene: Phaser.Scene;
  private readonly bus: RunEventBus;
  private readonly explosionPool: FixedObjectPool<Phaser.GameObjects.Arc>;
  private readonly particlePool: FixedObjectPool<Phaser.GameObjects.Arc>;
  private readonly explosionSprites: Phaser.GameObjects.Arc[] = [];
  private readonly particleSprites: Phaser.GameObjects.Arc[] = [];
  private readonly explosionDurationMs: number;
  private readonly particleDurationMs: number;
  private readonly maxActiveParticles: number;
  private readonly maxParticlesPerBurst: number;
  private readonly enableSubtleCameraShake: boolean;
  private readonly unsubscribers: Array<() => void> = [];

  private activeExplosions: ActiveExplosion[] = [];
  private activeParticles: ActiveParticle[] = [];
  private lastNowMs = 0;

  constructor(options: VfxSystemOptions) {
    this.scene = options.scene;
    this.bus = options.bus;
    this.explosionDurationMs = clampNonNegativeInt(
      options.explosionDurationMs ?? DEFAULT_EXPLOSION_DURATION_MS,
      DEFAULT_EXPLOSION_DURATION_MS,
    );
    this.particleDurationMs = clampNonNegativeInt(
      options.particleDurationMs ?? DEFAULT_PARTICLE_DURATION_MS,
      DEFAULT_PARTICLE_DURATION_MS,
    );
    this.maxActiveParticles = clampNonNegativeInt(
      options.maxActiveParticles ?? DEFAULT_MAX_ACTIVE_PARTICLES,
      DEFAULT_MAX_ACTIVE_PARTICLES,
    );
    this.maxParticlesPerBurst = clampNonNegativeInt(
      options.maxParticlesPerBurst ?? DEFAULT_MAX_PARTICLES_PER_BURST,
      DEFAULT_MAX_PARTICLES_PER_BURST,
    );
    this.enableSubtleCameraShake = options.enableSubtleCameraShake ?? false;

    this.explosionPool = FixedObjectPool.create(
      clampNonNegativeInt(
        options.explosionPoolSize ?? DEFAULT_EXPLOSION_POOL_SIZE,
        DEFAULT_EXPLOSION_POOL_SIZE,
      ),
      () => this.createExplosionSprite(),
    );
    this.particlePool = FixedObjectPool.create(
      clampNonNegativeInt(
        options.particlePoolSize ?? DEFAULT_PARTICLE_POOL_SIZE,
        DEFAULT_PARTICLE_POOL_SIZE,
      ),
      () => this.createParticleSprite(),
    );

    this.unsubscribers.push(
      this.bus.on(RUN_EVENT.ENEMY_KILLED, ({ nowMs, x, y }) => {
        if (typeof x === 'number' && typeof y === 'number') {
          this.spawnExplosion(x, y, nowMs);
        }
      }),
    );
  }

  update(nowMs: number): void {
    if (!Number.isFinite(nowMs) || nowMs < 0) return;
    const dtMs = Math.max(0, nowMs - this.lastNowMs);
    this.lastNowMs = nowMs;

    const remainingExplosions: ActiveExplosion[] = [];
    for (const explosion of this.activeExplosions) {
      if (nowMs >= explosion.endsAtMs) {
        this.releaseExplosion(explosion.sprite);
        continue;
      }
      const lifeRatio =
        this.explosionDurationMs <= 0
          ? 1
          : (nowMs - explosion.startedAtMs) / this.explosionDurationMs;
      const clampedLifeRatio = Math.max(0, Math.min(1, lifeRatio));
      explosion.sprite.setScale(0.5 + clampedLifeRatio * 1.1);
      explosion.sprite.setAlpha(EXPLOSION_ALPHA * (1 - clampedLifeRatio));
      remainingExplosions.push(explosion);
    }
    this.activeExplosions = remainingExplosions;

    const dtSeconds = dtMs / 1000;
    const remainingParticles: ActiveParticle[] = [];
    for (const particle of this.activeParticles) {
      if (nowMs >= particle.endsAtMs) {
        this.releaseParticle(particle.sprite);
        continue;
      }
      if (dtSeconds > 0) {
        particle.sprite.setPosition(
          particle.sprite.x + particle.velocityX * dtSeconds,
          particle.sprite.y + particle.velocityY * dtSeconds,
        );
      }
      const lifeRatio =
        this.particleDurationMs <= 0
          ? 1
          : (nowMs - particle.startedAtMs) / this.particleDurationMs;
      const clampedLifeRatio = Math.max(0, Math.min(1, lifeRatio));
      particle.sprite.setAlpha(PARTICLE_ALPHA * (1 - clampedLifeRatio));
      remainingParticles.push(particle);
    }
    this.activeParticles = remainingParticles;
  }

  spawnExplosion(x: number, y: number, nowMs: number): void {
    if (!Number.isFinite(nowMs) || nowMs < 0) return;
    const explosion = this.explosionPool.acquire();
    if (!explosion) {
      return;
    }

    explosion.setPosition(x, y);
    explosion.setScale(0.5);
    explosion.setAlpha(EXPLOSION_ALPHA);
    explosion.setVisible(true);
    explosion.setActive(true);
    this.activeExplosions.push({
      sprite: explosion,
      startedAtMs: nowMs,
      endsAtMs: nowMs + this.explosionDurationMs,
    });

    this.spawnParticles(x, y, nowMs);
    if (this.enableSubtleCameraShake) {
      this.triggerSubtleFeedback();
    }
  }

  clear(): void {
    for (const active of this.activeExplosions) {
      this.releaseExplosion(active.sprite);
    }
    for (const active of this.activeParticles) {
      this.releaseParticle(active.sprite);
    }
    this.activeExplosions = [];
    this.activeParticles = [];
    this.explosionPool.clear();
    this.particlePool.clear();
  }

  destroy(): void {
    this.clear();
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers.length = 0;
    for (const sprite of this.explosionSprites) {
      sprite.destroy();
    }
    for (const sprite of this.particleSprites) {
      sprite.destroy();
    }
    this.explosionSprites.length = 0;
    this.particleSprites.length = 0;
  }

  getDebugStats(): {
    activeExplosions: number;
    activeParticles: number;
    freeExplosions: number;
    freeParticles: number;
  } {
    return {
      activeExplosions: this.activeExplosions.length,
      activeParticles: this.activeParticles.length,
      freeExplosions: this.explosionPool.freeCount(),
      freeParticles: this.particlePool.freeCount(),
    };
  }

  private createExplosionSprite(): Phaser.GameObjects.Arc {
    const sprite = this.scene.add.circle(-1000, -1000, 8, 0xffa766);
    sprite.setVisible(false);
    sprite.setActive(false);
    sprite.setDepth(EXPLOSION_DEPTH);
    this.explosionSprites.push(sprite);
    return sprite;
  }

  private createParticleSprite(): Phaser.GameObjects.Arc {
    const sprite = this.scene.add.circle(-1000, -1000, 2, 0xffdc85);
    sprite.setVisible(false);
    sprite.setActive(false);
    sprite.setDepth(PARTICLE_DEPTH);
    this.particleSprites.push(sprite);
    return sprite;
  }

  private releaseExplosion(sprite: Phaser.GameObjects.Arc): void {
    sprite.setVisible(false);
    sprite.setActive(false);
    sprite.setPosition(-1000, -1000);
    this.explosionPool.release(sprite);
  }

  private releaseParticle(sprite: Phaser.GameObjects.Arc): void {
    sprite.setVisible(false);
    sprite.setActive(false);
    sprite.setPosition(-1000, -1000);
    this.particlePool.release(sprite);
  }

  private spawnParticles(x: number, y: number, nowMs: number): void {
    const spawnCount = computeParticleSpawnCount({
      requested: this.maxParticlesPerBurst,
      maxParticlesPerBurst: this.maxParticlesPerBurst,
      maxActiveParticles: this.maxActiveParticles,
      activeParticles: this.activeParticles.length,
    });
    for (let i = 0; i < spawnCount; i += 1) {
      const particle = this.particlePool.acquire();
      if (!particle) {
        return;
      }
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 70;
      particle.setPosition(x, y);
      particle.setAlpha(PARTICLE_ALPHA);
      particle.setVisible(true);
      particle.setActive(true);
      this.activeParticles.push({
        sprite: particle,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed,
        startedAtMs: nowMs,
        endsAtMs: nowMs + this.particleDurationMs,
      });
    }
  }

  private triggerSubtleFeedback(): void {
    this.scene.cameras.main.shake(60, 0.0008, true);
  }
}
