export class FixedObjectPool<T> {
  static create<T>(size: number, factory: () => T): FixedObjectPool<T> {
    const items: T[] = [];
    for (let i = 0; i < size; i += 1) {
      items.push(factory());
    }
    return new FixedObjectPool(items);
  }

  private readonly free: T[];
  private readonly active = new Set<T>();

  constructor(items: readonly T[]) {
    this.free = [...items];
  }

  acquire(): T | undefined {
    const item = this.free.pop();
    if (!item) return undefined;
    this.active.add(item);
    return item;
  }

  release(item: T): void {
    if (!this.active.has(item)) return;
    this.active.delete(item);
    this.free.push(item);
  }

  clear(): void {
    for (const item of this.active) {
      this.free.push(item);
    }
    this.active.clear();
  }

  activeCount(): number {
    return this.active.size;
  }

  freeCount(): number {
    return this.free.length;
  }

  activeItems(): readonly T[] {
    return [...this.active];
  }
}
