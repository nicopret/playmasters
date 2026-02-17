import type { SpaceBlasterRuntimeResolverResponseV1 } from '@playmasters/types';

export interface RuntimeResolvedBundleCacheEntry {
  readonly key: string;
  readonly gameId: string;
  readonly env: string;
  readonly versionId: string;
  readonly value: SpaceBlasterRuntimeResolverResponseV1;
  readonly expiresAt: number;
}

export interface RuntimeResolvedBundleCacheStats {
  readonly entries: number;
  readonly hits: number;
  readonly misses: number;
}

export interface RuntimeResolvedBundleCacheOptions {
  readonly maxEntries: number;
  readonly ttlMs: number;
  readonly now: () => number;
}

const DEFAULT_MAX_ENTRIES = 50;
const DEFAULT_TTL_MS = 10 * 60 * 1000;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function readCacheOptionsFromEnv(): RuntimeResolvedBundleCacheOptions {
  return {
    maxEntries: parsePositiveInt(
      process.env.RESOLVER_CACHE_MAX,
      DEFAULT_MAX_ENTRIES,
    ),
    ttlMs: parsePositiveInt(process.env.RESOLVER_CACHE_TTL_MS, DEFAULT_TTL_MS),
    now: () => Date.now(),
  };
}

export function buildResolvedBundleCacheKey(
  gameId: string,
  env: string,
  versionId: string,
): string {
  return `${gameId}:${env}:${versionId}`;
}

export class RuntimeResolvedBundleCache {
  private readonly store = new Map<string, RuntimeResolvedBundleCacheEntry>();

  private hits = 0;

  private misses = 0;

  constructor(private readonly options: RuntimeResolvedBundleCacheOptions) {}

  get(key: string): SpaceBlasterRuntimeResolverResponseV1 | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }
    if (entry.expiresAt <= this.options.now()) {
      this.store.delete(key);
      this.misses += 1;
      return undefined;
    }
    // Refresh LRU position.
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits += 1;
    return entry.value;
  }

  set(input: {
    key: string;
    gameId: string;
    env: string;
    versionId: string;
    value: SpaceBlasterRuntimeResolverResponseV1;
  }): void {
    const expiresAt = this.options.now() + this.options.ttlMs;
    const entry: RuntimeResolvedBundleCacheEntry = {
      ...input,
      expiresAt,
    };
    if (this.store.has(input.key)) this.store.delete(input.key);
    this.store.set(input.key, entry);
    this.evictOverflow();
  }

  invalidateGame(gameId: string, env: string): void {
    for (const [key, entry] of this.store.entries()) {
      if (entry.gameId === gameId && entry.env === env) {
        this.store.delete(key);
      }
    }
  }

  invalidateKey(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  stats(): RuntimeResolvedBundleCacheStats {
    return {
      entries: this.store.size,
      hits: this.hits,
      misses: this.misses,
    };
  }

  private evictOverflow(): void {
    while (this.store.size > this.options.maxEntries) {
      const oldestKey = this.store.keys().next().value as string | undefined;
      if (!oldestKey) return;
      this.store.delete(oldestKey);
    }
  }
}

export function createRuntimeResolvedBundleCache(
  options?: Partial<RuntimeResolvedBundleCacheOptions>,
): RuntimeResolvedBundleCache {
  const defaults = readCacheOptionsFromEnv();
  return new RuntimeResolvedBundleCache({
    maxEntries: options?.maxEntries ?? defaults.maxEntries,
    ttlMs: options?.ttlMs ?? defaults.ttlMs,
    now: options?.now ?? defaults.now,
  });
}

export const runtimeResolvedBundleCache = createRuntimeResolvedBundleCache();
