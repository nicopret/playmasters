import { WeaponSystem } from './WeaponSystem';

class FakeBody {
  enable = false;
  velocityY = 0;
  resetX = 0;
  resetY = 0;
  allowGravity = true;

  setAllowGravity(enabled: boolean): this {
    this.allowGravity = enabled;
    return this;
  }

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

class FakeRect {
  body: FakeBody = new FakeBody();
  x = -1000;
  y = -1000;
  visible = false;
  active = false;
  alpha = 1;
  scaleX = 1;
  scaleY = 1;
  rotation = 0;

  setVisible(visible: boolean): this {
    this.visible = visible;
    return this;
  }

  setActive(active: boolean): this {
    this.active = active;
    return this;
  }

  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  setAlpha(alpha: number): this {
    this.alpha = alpha;
    return this;
  }

  setScale(scale: number): this {
    this.scaleX = scale;
    this.scaleY = scale;
    return this;
  }

  setRotation(rotation: number): this {
    this.rotation = rotation;
    return this;
  }

  setDepth(): this {
    return this;
  }
}

const createScene = () => {
  const created: FakeRect[] = [];
  const groupItems: FakeRect[] = [];

  const scene = {
    add: {
      rectangle: () => {
        const rect = new FakeRect();
        created.push(rect);
        return rect;
      },
    },
    physics: {
      add: {
        group: () => ({ add: (item: FakeRect) => groupItems.push(item) }),
        existing: () => undefined,
      },
    },
  } as never;

  return { scene, created, groupItems };
};

describe('WeaponSystem projectile pooling', () => {
  it('reuses bullets and never allocates beyond cap', () => {
    const { scene, created } = createScene();
    const weapon = new WeaponSystem(
      scene,
      () => ({ minX: 0, maxX: 100, minY: 0, maxY: 100 }),
      {
        fireCooldownMs: 0,
        projectileSpeed: 500,
        poolInitialSize: 2,
        poolMaxSize: 2,
      },
    );

    expect(weapon.tryFire(10, 10, -1)).toBe(true);
    expect(weapon.tryFire(20, 10, -1)).toBe(true);
    expect(weapon.tryFire(30, 10, -1)).toBe(false);
    expect(created).toHaveLength(2);

    weapon.releaseProjectile(created[0] as never);
    expect(weapon.tryFire(40, 10, -1)).toBe(true);
    expect(created).toHaveLength(2);
    expect(weapon.getPoolStats().total).toBe(2);
  });

  it('resets bullet state on release', () => {
    const { scene, created } = createScene();
    const weapon = new WeaponSystem(
      scene,
      () => ({ minX: 0, maxX: 100, minY: 0, maxY: 100 }),
      {
        fireCooldownMs: 0,
        projectileSpeed: 300,
        poolInitialSize: 1,
        poolMaxSize: 1,
      },
    );

    expect(weapon.tryFire(12, 24, -1)).toBe(true);
    const bullet = created[0];
    expect(bullet.active).toBe(true);
    expect(bullet.visible).toBe(true);
    expect(bullet.body.enable).toBe(true);
    expect(bullet.body.velocityY).toBe(-300);

    weapon.releaseProjectile(bullet as never);

    expect(bullet.active).toBe(false);
    expect(bullet.visible).toBe(false);
    expect(bullet.body.enable).toBe(false);
    expect(bullet.body.velocityY).toBe(0);
    expect(bullet.x).toBe(-1000);
    expect(bullet.y).toBe(-1000);
    expect(bullet.alpha).toBe(1);
    expect(bullet.scaleX).toBe(1);
    expect(bullet.rotation).toBe(0);
  });
});
