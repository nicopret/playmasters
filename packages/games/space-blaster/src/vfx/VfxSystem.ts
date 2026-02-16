import type * as Phaser from 'phaser';
import type { RunContext } from '../runtime';
import { RUN_EVENT, type RunEventBus } from '../run';
import { ObjectPool } from '../perf/ObjectPool';
import { PoolLimits } from '../perf/poolLimits';
import { ExplosionPool } from './ExplosionPool';
import { ParticleBudget } from './ParticleBudget';

const DEFAULT_EXPLOSION_POOL_SIZE = PoolLimits.explosions.initial;
const DEFAULT_EXPLOSION_POOL_MAX = PoolLimits.explosions.max;
const DEFAULT_PARTICLE_POOL_SIZE = PoolLimits.particles.initial;
const DEFAULT_PARTICLE_POOL_MAX = PoolLimits.particles.max;
const DEFAULT_PARTICLE_DURATION_MS = 180;
const DEFAULT_MAX_PARTICLES_PER_BURST = 10;
const EXPLOSION_DEPTH = 10;
const PARTICLE_DEPTH = 9;
const PARTICLE_ALPHA = 0.55;

type VfxSystemOptions = {
  scene: Phaser.Scene;
  ctx: RunContext;
  bus: RunEventBus;
  explosionPoolSize?: number;
  explosionPoolMax?: number;
  particlePoolSize?: number;
  particlePoolMax?: number;
  particleDurationMs?: number;
  maxActiveParticles?: number;
  maxParticlesPerBurst?: number;
  enableSubtleCameraShake?: boolean;
};

type ActiveParticle = {
  sprite: Phaser.GameObjects.Arc;
  velocityX: number;
  velocityY: number;
  startedAtMs: number;
  endsAtMs: number;
};

export type VfxPoolStats = {
  explosions: { free: number; active: number; total: number; max: number };
  particles: {
    free: number;
    active: number;
    total: number;
    max: number;
    inUse: number;
    maxBudget: number;
    activeBursts: number;
  };
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
  private readonly explosionPool: ExplosionPool;
  private readonly particlePool: ObjectPool<Phaser.GameObjects.Arc>;
  private readonly particleSprites: Phaser.GameObjects.Arc[] = [];
  private readonly particleDurationMs: number;
  private readonly maxActiveParticles: number;
  private readonly maxParticlesPerBurst: number;
  private readonly enableSubtleCameraShake: boolean;
  private readonly particleBudget: ParticleBudget;
  private readonly unsubscribers: Array<() => void> = [];

  private activeParticles: ActiveParticle[] = [];
  private lastNowMs = 0;

  constructor(options: VfxSystemOptions) {
    this.scene = options.scene;
    this.bus = options.bus;
    this.particleDurationMs = clampNonNegativeInt(
      options.particleDurationMs ?? DEFAULT_PARTICLE_DURATION_MS,
      DEFAULT_PARTICLE_DURATION_MS,
    );
    this.maxParticlesPerBurst = clampNonNegativeInt(
      options.maxParticlesPerBurst ?? DEFAULT_MAX_PARTICLES_PER_BURST,
      DEFAULT_MAX_PARTICLES_PER_BURST,
    );
    const particlePoolMax = clampNonNegativeInt(
      options.particlePoolMax ?? DEFAULT_PARTICLE_POOL_MAX,
      DEFAULT_PARTICLE_POOL_MAX,
    );
    this.maxActiveParticles = Math.min(
      particlePoolMax,
      clampNonNegativeInt(
        options.maxActiveParticles ?? particlePoolMax,
        particlePoolMax,
      ),
    );
    this.enableSubtleCameraShake = options.enableSubtleCameraShake ?? false;

    this.explosionPool = new ExplosionPool({
      scene: this.scene,
      initial: clampNonNegativeInt(
        options.explosionPoolSize ?? DEFAULT_EXPLOSION_POOL_SIZE,
        DEFAULT_EXPLOSION_POOL_SIZE,
      ),
      max: clampNonNegativeInt(
        options.explosionPoolMax ?? DEFAULT_EXPLOSION_POOL_MAX,
        DEFAULT_EXPLOSION_POOL_MAX,
      ),
      depth: EXPLOSION_DEPTH,
      fallbackDurationMs: 260,
    });

    this.particlePool = new ObjectPool({
      initial: clampNonNegativeInt(
        options.particlePoolSize ?? DEFAULT_PARTICLE_POOL_SIZE,
        DEFAULT_PARTICLE_POOL_SIZE,
      ),
      max: particlePoolMax,
      create: () => this.createParticleSprite(),
      onRelease: (sprite) => {
        sprite.setVisible(false);
        sprite.setActive(false);
        sprite.setPosition(-1000, -1000);
        sprite.setAlpha(1);
      },
    });

    this.particleBudget = new ParticleBudget({
      maxActiveParticles: this.maxActiveParticles,
      maxParticlesPerBurst: this.maxParticlesPerBurst,
      burstLifetimeMs: this.particleDurationMs,
    });

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
    this.particleBudget.update(nowMs);
    this.explosionPool.update(nowMs, (sprite) => this.releaseExplosion(sprite));

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
    const sprite = this.explosionPool.spawn({
      x,
      y,
      nowMs,
      onComplete: (completed) => this.releaseExplosion(completed),
    });
    if (!sprite) {
      return;
    }

    this.spawnParticles(x, y, nowMs);
    if (this.enableSubtleCameraShake) {
      this.triggerSubtleFeedback();
    }
  }

  clear(): void {
    for (const active of this.activeParticles) {
      this.releaseParticle(active.sprite);
    }
    this.activeParticles = [];
    this.particleBudget.reset();
    this.explosionPool.resetAll();
    this.particlePool.resetAll();
  }

  resetAll(): void {
    this.clear();
  }

  destroy(): void {
    this.clear();
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers.length = 0;
    this.explosionPool.destroy();
    for (const sprite of this.particleSprites) {
      sprite.destroy();
    }
    this.particleSprites.length = 0;
  }

  getDebugStats(): {
    activeExplosions: number;
    activeParticles: number;
    freeExplosions: number;
    freeParticles: number;
    particleInUse: number;
    activeBursts: number;
  } {
    const pools = this.getPoolStats();
    return {
      activeExplosions: pools.explosions.active,
      activeParticles: this.activeParticles.length,
      freeExplosions: pools.explosions.free,
      freeParticles: pools.particles.free,
      particleInUse: pools.particles.inUse,
      activeBursts: pools.particles.activeBursts,
    };
  }

  getPoolStats(): VfxPoolStats {
    const explosionStats = this.explosionPool.stats();
    const particleStats = this.particlePool.stats();
    return {
      explosions: explosionStats,
      particles: {
        ...particleStats,
        inUse: this.particleBudget.getInUse(),
        maxBudget: this.maxActiveParticles,
        activeBursts: this.particleBudget.getActiveBurstCount(),
      },
    };
  }

  private createParticleSprite(): Phaser.GameObjects.Arc {
    const sprite = this.scene.add.circle(-1000, -1000, 2, 0xffdc85);
    sprite.setVisible(false);
    sprite.setActive(false);
    sprite.setDepth(PARTICLE_DEPTH);
    this.particleSprites.push(sprite);
    return sprite;
  }

  private releaseExplosion(sprite: Phaser.GameObjects.Sprite): void {
    this.explosionPool.release(sprite);
  }

  private releaseParticle(sprite: Phaser.GameObjects.Arc): void {
    this.particlePool.release(sprite);
  }

  private spawnParticles(x: number, y: number, nowMs: number): void {
    const granted = this.particleBudget.reserve(
      this.maxParticlesPerBurst,
      nowMs,
    );
    for (let i = 0; i < granted; i += 1) {
      const particle = this.particlePool.acquire();
      if (!particle) {
        return;
      }
      const t = granted <= 1 ? 0 : i / (granted - 1);
      const angle = t * Math.PI * 2;
      const speed = 50 + (i % 4) * 18;
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
