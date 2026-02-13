import { FixedObjectPool } from './object-pool';

describe('FixedObjectPool', () => {
  it('reuses object identities', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    const pool = new FixedObjectPool([a, b]);

    const first = pool.acquire();
    const second = pool.acquire();
    expect(first).toBeDefined();
    expect(second).toBeDefined();

    pool.release(first as { id: string });
    const third = pool.acquire();
    expect(third).toBe(first);
  });

  it('does not allocate after prewarm', () => {
    let created = 0;
    const pool = FixedObjectPool.create(3, () => {
      created += 1;
      return { id: created };
    });
    expect(created).toBe(3);

    const one = pool.acquire();
    const two = pool.acquire();
    const three = pool.acquire();
    expect(pool.acquire()).toBeUndefined();
    expect(created).toBe(3);

    pool.release(one as { id: number });
    pool.release(two as { id: number });
    pool.release(three as { id: number });
    expect(created).toBe(3);
  });
});
