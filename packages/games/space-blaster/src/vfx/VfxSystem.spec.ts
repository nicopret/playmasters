import type * as Phaser from 'phaser';
import { RunEventBus, RUN_EVENT } from '../run';
import { VfxSystem, computeParticleSpawnCount } from './VfxSystem';

class FakeArc {
  x = -1000;
  y = -1000;
  visible = false;
  active = false;
  alpha = 1;
  scale = 1;
  depth = 0;
  destroyed = false;

  setVisible(next: boolean): this {
    this.visible = next;
    return this;
  }

  setActive(next: boolean): this {
    this.active = next;
    return this;
  }

  setDepth(next: number): this {
    this.depth = next;
    return this;
  }

  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  setScale(next: number): this {
    this.scale = next;
    return this;
  }

  setAlpha(next: number): this {
    this.alpha = next;
    return this;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

const createScene = (): Phaser.Scene =>
  ({
    add: {
      circle: () => new FakeArc(),
    },
    cameras: {
      main: {
        shake: jest.fn(),
      },
    },
  }) as unknown as Phaser.Scene;

describe('computeParticleSpawnCount', () => {
  it('caps spawn count by burst and active particle budget', () => {
    expect(
      computeParticleSpawnCount({
        requested: 10,
        maxParticlesPerBurst: 8,
        maxActiveParticles: 40,
        activeParticles: 0,
      }),
    ).toBe(8);
    expect(
      computeParticleSpawnCount({
        requested: 10,
        maxParticlesPerBurst: 8,
        maxActiveParticles: 40,
        activeParticles: 37,
      }),
    ).toBe(3);
  });
});

describe('VfxSystem', () => {
  it('pools explosion sprites and auto-releases after duration', () => {
    const bus = new RunEventBus();
    const system = new VfxSystem({
      scene: createScene(),
      ctx: {} as never,
      bus,
      explosionPoolSize: 2,
      particlePoolSize: 0,
      explosionDurationMs: 100,
    });

    bus.emit(RUN_EVENT.ENEMY_KILLED, {
      enemyId: 'enemy-a',
      nowMs: 10,
      x: 100,
      y: 100,
    });
    system.update(10);
    expect(system.getDebugStats().activeExplosions).toBe(1);

    system.update(109);
    expect(system.getDebugStats().activeExplosions).toBe(1);

    system.update(110);
    expect(system.getDebugStats().activeExplosions).toBe(0);
    expect(system.getDebugStats().freeExplosions).toBe(2);

    system.destroy();
  });

  it('keeps particle count capped under burst load', () => {
    const bus = new RunEventBus();
    const system = new VfxSystem({
      scene: createScene(),
      ctx: {} as never,
      bus,
      explosionPoolSize: 4,
      particlePoolSize: 8,
      maxActiveParticles: 5,
      maxParticlesPerBurst: 10,
      particleDurationMs: 1000,
    });

    for (let i = 0; i < 5; i += 1) {
      bus.emit(RUN_EVENT.ENEMY_KILLED, {
        enemyId: `enemy-${i}`,
        nowMs: 10,
        x: 100,
        y: 100,
      });
      system.update(10);
    }

    expect(system.getDebugStats().activeParticles).toBeLessThanOrEqual(5);
    system.destroy();
  });

  it('uses sim clock so frozen nowMs pauses expiry', () => {
    const bus = new RunEventBus();
    const system = new VfxSystem({
      scene: createScene(),
      ctx: {} as never,
      bus,
      explosionPoolSize: 1,
      particlePoolSize: 0,
      explosionDurationMs: 100,
    });

    bus.emit(RUN_EVENT.ENEMY_KILLED, {
      enemyId: 'enemy-a',
      nowMs: 0,
      x: 5,
      y: 5,
    });
    system.update(0);
    system.update(0);

    expect(system.getDebugStats().activeExplosions).toBe(1);
    system.update(101);
    expect(system.getDebugStats().activeExplosions).toBe(0);
    system.destroy();
  });
});
