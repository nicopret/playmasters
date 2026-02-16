import { ObjectPool } from './ObjectPool';

describe('ObjectPool', () => {
  it('initializes with prewarmed initial size', () => {
    let created = 0;
    const pool = new ObjectPool({
      initial: 3,
      max: 5,
      create: () => ({ id: ++created }),
    });

    expect(created).toBe(3);
    expect(pool.stats()).toEqual({ free: 3, active: 0, total: 3, max: 5 });
  });

  it('enforces hard cap and returns null when exhausted', () => {
    let created = 0;
    const pool = new ObjectPool({
      initial: 1,
      max: 2,
      create: () => ({ id: ++created }),
    });

    const first = pool.acquire();
    const second = pool.acquire();
    const third = pool.acquire();

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(third).toBeNull();
    expect(created).toBe(2);
  });

  it('releases back to free list and reuses identity', () => {
    const pool = new ObjectPool({
      initial: 1,
      max: 1,
      create: () => ({ id: 'only' }),
    });

    const one = pool.acquire();
    expect(one).not.toBeNull();
    pool.release(one as { id: string });
    const two = pool.acquire();

    expect(two).toBe(one);
    expect(pool.stats()).toEqual({ free: 0, active: 1, total: 1, max: 1 });
  });

  it('resetAll releases every active item', () => {
    const pool = new ObjectPool<object>({
      initial: 0,
      max: 3,
      create: () => ({}),
    });

    const a = pool.acquire();
    const b = pool.acquire();
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();

    pool.resetAll();
    expect(pool.stats()).toEqual({ free: 2, active: 0, total: 2, max: 3 });
  });

  it('calls lifecycle hooks on acquire/release', () => {
    const onAcquire = jest.fn();
    const onRelease = jest.fn();
    const pool = new ObjectPool({
      initial: 1,
      max: 1,
      create: () => ({ id: 'x' }),
      onAcquire,
      onRelease,
    });

    const item = pool.acquire();
    expect(item).not.toBeNull();
    pool.release(item as { id: string });

    expect(onAcquire).toHaveBeenCalledTimes(1);
    expect(onRelease).toHaveBeenCalledTimes(1);
  });
});
