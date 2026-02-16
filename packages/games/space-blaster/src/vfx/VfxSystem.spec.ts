import { RunEventBus, RUN_EVENT } from '../run';
import { VfxSystem, computeParticleSpawnCount } from './VfxSystem';

class FakeSprite {
  x = -1000;
  y = -1000;
  visible = false;
  active = false;
  alpha = 1;
  scale = 1;
  rotation = 0;
  depth = 0;
  destroyed = false;
  listeners = new Map<string, Array<() => void>>();

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

  setRotation(next: number): this {
    this.rotation = next;
    return this;
  }

  once(eventName: string, callback: () => void): this {
    const callbacks = this.listeners.get(eventName) ?? [];
    callbacks.push(callback);
    this.listeners.set(eventName, callbacks);
    return this;
  }

  off(eventName: string): this {
    this.listeners.delete(eventName);
    return this;
  }

  removeAllListeners(eventName?: string): this {
    if (eventName) {
      this.listeners.delete(eventName);
    } else {
      this.listeners.clear();
    }
    return this;
  }

  emit(eventName: string): this {
    const callbacks = this.listeners.get(eventName) ?? [];
    for (const cb of callbacks) {
      cb();
    }
    this.listeners.delete(eventName);
    return this;
  }

  play(): this {
    return this;
  }

  stop(): this {
    return this;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

class FakeArc extends FakeSprite {}

const createScene = () => {
  const sprites: FakeSprite[] = [];
  const scene = {
    add: {
      sprite: () => {
        const sprite = new FakeSprite();
        sprites.push(sprite);
        return sprite;
      },
      circle: () => new FakeArc(),
      graphics: () => ({
        clear: () => undefined,
        fillStyle: () => undefined,
        fillCircle: () => undefined,
        generateTexture: () => undefined,
        destroy: () => undefined,
      }),
    },
    anims: {
      exists: () => true,
      create: () => undefined,
    },
    textures: {
      exists: () => true,
    },
    cameras: {
      main: {
        shake: jest.fn(),
      },
    },
  } as never;
  return { scene, sprites };
};

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
  it('pools explosion sprites and auto-releases on animation complete', () => {
    const bus = new RunEventBus();
    const fixture = createScene();
    const system = new VfxSystem({
      scene: fixture.scene,
      ctx: {} as never,
      bus,
      explosionPoolSize: 2,
      explosionPoolMax: 2,
      particlePoolSize: 0,
      particlePoolMax: 0,
    });

    bus.emit(RUN_EVENT.ENEMY_KILLED, {
      enemyId: 'enemy-a',
      nowMs: 10,
      x: 100,
      y: 100,
    });

    expect(system.getDebugStats().activeExplosions).toBe(1);
    for (const sprite of fixture.sprites) {
      sprite.emit('animationcomplete');
    }
    expect(system.getDebugStats().activeExplosions).toBe(0);
    expect(system.getDebugStats().freeExplosions).toBe(2);
    system.destroy();
  });

  it('keeps particle count capped under burst load', () => {
    const bus = new RunEventBus();
    const fixture = createScene();
    const system = new VfxSystem({
      scene: fixture.scene,
      ctx: {} as never,
      bus,
      explosionPoolSize: 4,
      explosionPoolMax: 4,
      particlePoolSize: 8,
      particlePoolMax: 8,
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
    expect(system.getDebugStats().particleInUse).toBeLessThanOrEqual(5);
    system.destroy();
  });

  it('uses sim clock so frozen nowMs pauses particle expiry', () => {
    const bus = new RunEventBus();
    const fixture = createScene();
    const system = new VfxSystem({
      scene: fixture.scene,
      ctx: {} as never,
      bus,
      explosionPoolSize: 1,
      explosionPoolMax: 1,
      particlePoolSize: 4,
      particlePoolMax: 4,
      maxActiveParticles: 4,
      maxParticlesPerBurst: 2,
      particleDurationMs: 100,
    });

    bus.emit(RUN_EVENT.ENEMY_KILLED, {
      enemyId: 'enemy-a',
      nowMs: 0,
      x: 5,
      y: 5,
    });
    system.update(0);
    system.update(0);

    expect(system.getDebugStats().activeParticles).toBeGreaterThan(0);
    system.update(101);
    expect(system.getDebugStats().activeParticles).toBe(0);
    system.destroy();
  });
});
