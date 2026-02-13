import type { RunEventMap } from './RunEvents';

type EventKey = keyof RunEventMap;
type Listener<K extends EventKey> = (payload: RunEventMap[K]) => void;

export class RunEventBus {
  private listeners = new Map<EventKey, Set<(...args: unknown[]) => void>>();

  on<K extends EventKey>(event: K, listener: Listener<K>): () => void {
    const existing =
      this.listeners.get(event) ?? new Set<(...args: unknown[]) => void>();
    existing.add(listener as (...args: unknown[]) => void);
    this.listeners.set(event, existing);
    return () => this.off(event, listener);
  }

  off<K extends EventKey>(event: K, listener: Listener<K>): void {
    const existing = this.listeners.get(event);
    existing?.delete(listener as (...args: unknown[]) => void);
    if (existing && existing.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit<K extends EventKey>(event: K, payload: RunEventMap[K]): void {
    const existing = this.listeners.get(event);
    if (!existing) return;
    for (const listener of existing) {
      (listener as Listener<K>)(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
