import type * as Phaser from 'phaser';
import { ObjectPool } from '../perf/ObjectPool';

const OFFSCREEN_X = -1000;
const OFFSCREEN_Y = -1000;
const DEFAULT_EXPLOSION_ANIMATION_KEY = 'vfx-explosion';
const DEFAULT_EXPLOSION_DEPTH = 10;
const DEFAULT_FRAME_COUNT = 5;
const DEFAULT_FRAME_DURATION_MS = 45;

const clampInt = (value: number, fallback: number): number => {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
};

type ExplosionPoolOptions = {
  scene: Phaser.Scene;
  initial: number;
  max: number;
  depth?: number;
  animationKey?: string;
  fallbackDurationMs?: number;
};

type ActiveExplosion = {
  sprite: Phaser.GameObjects.Sprite;
  endsAtMs: number;
};

export class ExplosionPool {
  private readonly scene: Phaser.Scene;
  private readonly depth: number;
  private readonly animationKey: string;
  private readonly fallbackDurationMs: number;
  private readonly sprites: Phaser.GameObjects.Sprite[] = [];
  private readonly activeFallback = new Map<
    Phaser.GameObjects.Sprite,
    ActiveExplosion
  >();
  private readonly pool: ObjectPool<Phaser.GameObjects.Sprite>;

  constructor(options: ExplosionPoolOptions) {
    this.scene = options.scene;
    this.depth = options.depth ?? DEFAULT_EXPLOSION_DEPTH;
    this.animationKey = options.animationKey ?? DEFAULT_EXPLOSION_ANIMATION_KEY;
    this.fallbackDurationMs = clampInt(options.fallbackDurationMs ?? 240, 240);

    this.ensureAnimation();

    this.pool = new ObjectPool({
      initial: clampInt(options.initial, 0),
      max: clampInt(options.max, 0),
      create: () => this.createSprite(),
      onRelease: (sprite) => this.resetSprite(sprite),
    });
  }

  spawn(args: {
    x: number;
    y: number;
    nowMs: number;
    onComplete: (sprite: Phaser.GameObjects.Sprite) => void;
  }): Phaser.GameObjects.Sprite | null {
    const sprite = this.pool.acquire();
    if (!sprite) {
      return null;
    }

    sprite.setDepth(this.depth);
    sprite.setPosition(args.x, args.y);
    sprite.setActive(true);
    sprite.setVisible(true);
    sprite.setAlpha(0.68);
    sprite.setScale(1);
    sprite.setRotation(0);
    sprite.removeAllListeners('animationcomplete');
    sprite.once('animationcomplete', () => {
      this.activeFallback.delete(sprite);
      args.onComplete(sprite);
    });

    if (this.scene.anims?.exists(this.animationKey)) {
      sprite.play(this.animationKey);
    } else {
      this.activeFallback.set(sprite, {
        sprite,
        endsAtMs: args.nowMs + this.fallbackDurationMs,
      });
    }
    return sprite;
  }

  update(
    nowMs: number,
    onFallbackComplete: (s: Phaser.GameObjects.Sprite) => void,
  ): void {
    if (!Number.isFinite(nowMs) || this.activeFallback.size === 0) {
      return;
    }

    for (const [sprite, active] of this.activeFallback.entries()) {
      if (nowMs >= active.endsAtMs) {
        this.activeFallback.delete(sprite);
        onFallbackComplete(sprite);
      }
    }
  }

  release(sprite: Phaser.GameObjects.Sprite): void {
    this.activeFallback.delete(sprite);
    this.pool.release(sprite);
  }

  resetAll(): void {
    this.activeFallback.clear();
    this.pool.resetAll();
  }

  destroy(): void {
    this.resetAll();
    for (const sprite of this.sprites) {
      sprite.destroy();
    }
    this.sprites.length = 0;
  }

  activeItems(): readonly Phaser.GameObjects.Sprite[] {
    return this.pool.activeItems();
  }

  stats(): { free: number; active: number; total: number; max: number } {
    return this.pool.stats();
  }

  private createSprite(): Phaser.GameObjects.Sprite {
    const textureKey = `${this.animationKey}-f0`;
    const sprite = this.scene.add.sprite(OFFSCREEN_X, OFFSCREEN_Y, textureKey);
    sprite.setVisible(false);
    sprite.setActive(false);
    sprite.setDepth(this.depth);
    this.sprites.push(sprite);
    return sprite;
  }

  private resetSprite(sprite: Phaser.GameObjects.Sprite): void {
    sprite.stop();
    sprite.removeAllListeners('animationcomplete');
    sprite.setActive(false);
    sprite.setVisible(false);
    sprite.setPosition(OFFSCREEN_X, OFFSCREEN_Y);
    sprite.setAlpha(1);
    sprite.setScale(1);
    sprite.setRotation(0);
  }

  private ensureAnimation(): void {
    if (!this.scene.textures || !this.scene.anims) {
      return;
    }
    if (!this.scene.anims.exists(this.animationKey)) {
      for (let i = 0; i < DEFAULT_FRAME_COUNT; i += 1) {
        this.ensureFrameTexture(i);
      }
      const frames = Array.from({ length: DEFAULT_FRAME_COUNT }, (_, i) => ({
        key: `${this.animationKey}-f${i}`,
      }));
      this.scene.anims.create({
        key: this.animationKey,
        frames,
        frameRate: 1000 / DEFAULT_FRAME_DURATION_MS,
        repeat: 0,
      });
    }
  }

  private ensureFrameTexture(index: number): void {
    const key = `${this.animationKey}-f${index}`;
    if (this.scene.textures.exists(key)) {
      return;
    }
    const gfx = this.scene.add.graphics();
    const radius = 4 + index * 2;
    const alpha = Math.max(0.2, 0.9 - index * 0.15);
    gfx.clear();
    gfx.fillStyle(0xffd070, alpha);
    gfx.fillCircle(radius + 2, radius + 2, radius);
    gfx.fillStyle(0xff8e4a, Math.max(0.1, alpha - 0.2));
    gfx.fillCircle(radius + 2, radius + 2, Math.max(1, radius - 2));
    gfx.generateTexture(key, radius * 2 + 4, radius * 2 + 4);
    gfx.destroy();
  }
}
