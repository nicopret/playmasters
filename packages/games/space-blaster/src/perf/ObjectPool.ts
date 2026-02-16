export type ObjectPoolOptions<T> = {
  initial: number;
  max: number;
  create: () => T;
  onAcquire?: (item: T) => void;
  onRelease?: (item: T) => void;
};

const normalizeInt = (value: number, fallback: number): number => {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
};

export class ObjectPool<T> {
  private readonly free: T[] = [];
  private readonly active = new Set<T>();
  private readonly max: number;
  private readonly create: () => T;
  private readonly onAcquire?: (item: T) => void;
  private readonly onRelease?: (item: T) => void;
  private total = 0;

  constructor(options: ObjectPoolOptions<T>) {
    const initial = normalizeInt(options.initial, 0);
    const max = Math.max(initial, normalizeInt(options.max, initial));
    this.max = max;
    this.create = options.create;
    this.onAcquire = options.onAcquire;
    this.onRelease = options.onRelease;

    for (let i = 0; i < initial; i += 1) {
      const item = this.create();
      this.free.push(item);
      this.total += 1;
    }
  }

  acquire(): T | null {
    const item = this.free.pop() ?? this.allocate();
    if (!item) {
      return null;
    }
    this.active.add(item);
    this.onAcquire?.(item);
    return item;
  }

  release(item: T): void {
    if (!this.active.has(item)) {
      return;
    }
    this.active.delete(item);
    this.onRelease?.(item);
    this.free.push(item);
  }

  resetAll(): void {
    for (const item of [...this.active]) {
      this.release(item);
    }
  }

  stats(): { free: number; active: number; total: number; max: number } {
    return {
      free: this.free.length,
      active: this.active.size,
      total: this.total,
      max: this.max,
    };
  }

  activeItems(): readonly T[] {
    return [...this.active];
  }

  activeCount(): number {
    return this.active.size;
  }

  freeCount(): number {
    return this.free.length;
  }

  clear(): void {
    this.resetAll();
  }

  private allocate(): T | null {
    if (this.total >= this.max) {
      return null;
    }
    const item = this.create();
    this.total += 1;
    return item;
  }
}
