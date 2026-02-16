import {
  ProjectilePool,
  resetBulletOnAcquire,
  resetBulletOnRelease,
  type ProjectileLike,
} from './ProjectilePool';

class FakeBody {
  enable = false;
  velocityY = 0;
  resetX = 0;
  resetY = 0;

  stop(): void {
    this.velocityY = 0;
  }

  reset(x: number, y: number): void {
    this.resetX = x;
    this.resetY = y;
  }

  setVelocityY(velocityY: number): void {
    this.velocityY = velocityY;
  }
}

const createFakeProjectile = (): ProjectileLike => {
  const body = new FakeBody();
  return {
    body,
    active: false,
    visible: false,
    x: -1000,
    y: -1000,
    alpha: 0.2,
    scaleX: 2,
    scaleY: 2,
    rotation: 1,
    setActive(active) {
      this.active = active;
      return this;
    },
    setVisible(visible) {
      this.visible = visible;
      return this;
    },
    setPosition(x, y) {
      this.x = x;
      this.y = y;
      return this;
    },
    setAlpha(alpha) {
      this.alpha = alpha;
      return this;
    },
    setScale(scale) {
      this.scaleX = scale;
      this.scaleY = scale;
      return this;
    },
    setRotation(rotation) {
      this.rotation = rotation;
      return this;
    },
    setDepth() {
      return this;
    },
  };
};

describe('ProjectilePool', () => {
  it('resets projectile state on acquire and release', () => {
    const projectile = createFakeProjectile();
    resetBulletOnAcquire(projectile, {
      x: 10,
      y: 20,
      velocityY: -300,
      owner: 'player',
    });

    expect(projectile.active).toBe(true);
    expect(projectile.visible).toBe(true);
    expect(projectile.x).toBe(10);
    expect(projectile.y).toBe(20);
    expect(projectile.alpha).toBe(1);
    expect(projectile.scaleX).toBe(1);
    expect(projectile.rotation).toBe(0);
    expect((projectile.body as FakeBody).enable).toBe(true);
    expect((projectile.body as FakeBody).velocityY).toBe(-300);

    resetBulletOnRelease(projectile);
    expect(projectile.active).toBe(false);
    expect(projectile.visible).toBe(false);
    expect(projectile.x).toBe(-1000);
    expect(projectile.y).toBe(-1000);
    expect((projectile.body as FakeBody).enable).toBe(false);
    expect((projectile.body as FakeBody).velocityY).toBe(0);
  });

  it('returns null at cap and reuses released projectile', () => {
    let created = 0;
    const pool = new ProjectilePool({
      initial: 1,
      max: 2,
      owner: 'enemy',
      create: () => {
        created += 1;
        return createFakeProjectile();
      },
    });

    const a = pool.spawnBullet({ x: 0, y: 0, velocityY: 100 });
    const b = pool.spawnBullet({ x: 1, y: 1, velocityY: 100 });
    const c = pool.spawnBullet({ x: 2, y: 2, velocityY: 100 });

    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(c).toBeNull();
    expect(created).toBe(2);

    pool.releaseBullet(a as ProjectileLike);
    const d = pool.spawnBullet({ x: 9, y: 9, velocityY: 100 });
    expect(d).toBe(a);
    expect(created).toBe(2);
  });
});
