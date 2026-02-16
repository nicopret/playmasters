import { ObjectPool } from '../perf/ObjectPool';

export class FixedObjectPool<T> {
  static create<T>(size: number, factory: () => T): FixedObjectPool<T> {
    const pool = new ObjectPool<T>({
      initial: size,
      max: size,
      create: factory,
    });
    return new FixedObjectPool(pool);
  }

  private readonly pool: ObjectPool<T>;

  constructor(itemsOrPool: readonly T[] | ObjectPool<T>) {
    if (itemsOrPool instanceof ObjectPool) {
      this.pool = itemsOrPool;
      return;
    }
    let index = 0;
    this.pool = new ObjectPool<T>({
      initial: itemsOrPool.length,
      max: itemsOrPool.length,
      create: () => itemsOrPool[index++] as T,
    });
  }

  acquire(): T | undefined {
    return this.pool.acquire() ?? undefined;
  }

  release(item: T): void {
    this.pool.release(item);
  }

  clear(): void {
    this.pool.resetAll();
  }

  activeCount(): number {
    return this.pool.activeCount();
  }

  freeCount(): number {
    return this.pool.freeCount();
  }

  activeItems(): readonly T[] {
    return this.pool.activeItems();
  }
}
