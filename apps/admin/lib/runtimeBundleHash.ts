import { createHash } from 'crypto';

type BundleRecord = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry));
  if (!isRecord(value)) return value;

  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const next = canonicalize(value[key]);
    if (next !== undefined) out[key] = next;
  }
  return out;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256HexFromValue(value: unknown): string {
  return createHash('sha256')
    .update(stableStringify(value), 'utf8')
    .digest('hex');
}

export function stripHashFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => stripHashFields(entry));
  if (!isRecord(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'configHash' || key === 'versionHash') continue;
    out[key] = stripHashFields(entry);
  }
  return out;
}

export function computeConfigHashForBundle(bundle: unknown): string {
  const sanitized = stripHashFields(bundle) as BundleRecord;
  return sha256HexFromValue(sortBundleDomains(sanitized));
}

export function computeVersionHashForBundle(bundle: unknown): string {
  // In v1, versionHash tracks the same canonical bundle content as configHash.
  return computeConfigHashForBundle(bundle);
}

export function resolveBundleHashes(input: {
  bundle: unknown;
  publishedConfigHash?: string;
  publishedVersionHash?: string;
}): { configHash: string; versionHash: string } {
  const publishedConfigHash =
    typeof input.publishedConfigHash === 'string' &&
    input.publishedConfigHash.length > 0
      ? input.publishedConfigHash
      : undefined;
  const publishedVersionHash =
    typeof input.publishedVersionHash === 'string' &&
    input.publishedVersionHash.length > 0
      ? input.publishedVersionHash
      : undefined;

  const computedConfigHash = computeConfigHashForBundle(input.bundle);
  const configHash = publishedConfigHash ?? computedConfigHash;
  const versionHash =
    publishedVersionHash ?? computeVersionHashForBundle(input.bundle);

  return { configHash, versionHash };
}

type LayoutEntry = { layoutId: string; [k: string]: unknown };
type EnemyEntry = { enemyId: string; [k: string]: unknown };
type HeroEntry = { heroId: string; [k: string]: unknown };
type AmmoEntry = { ammoId: string; [k: string]: unknown };

function sortBundleDomains(bundle: BundleRecord): BundleRecord {
  const sorted = { ...bundle };
  if (
    sorted.levels &&
    typeof sorted.levels === 'object' &&
    !Array.isArray(sorted.levels)
  ) {
    sorted.levels = Object.entries(sorted.levels as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .reduce(
        (acc, [k, v]) => {
          acc[k] = v;
          return acc;
        },
        {} as Record<string, unknown>,
      );
  }
  if (sorted.enemyCatalog && typeof sorted.enemyCatalog === 'object') {
    const entries = (sorted.enemyCatalog as { entries?: EnemyEntry[] }).entries;
    if (Array.isArray(entries)) {
      (sorted.enemyCatalog as { entries: EnemyEntry[] }).entries = [
        ...entries,
      ].sort((a, b) => a.enemyId.localeCompare(b.enemyId));
    }
  }
  if (sorted.heroCatalog && typeof sorted.heroCatalog === 'object') {
    const entries = (sorted.heroCatalog as { entries?: HeroEntry[] }).entries;
    if (Array.isArray(entries)) {
      (sorted.heroCatalog as { entries: HeroEntry[] }).entries = [
        ...entries,
      ].sort((a, b) => a.heroId.localeCompare(b.heroId));
    }
  }
  if (sorted.ammoCatalog && typeof sorted.ammoCatalog === 'object') {
    const entries = (sorted.ammoCatalog as { entries?: AmmoEntry[] }).entries;
    if (Array.isArray(entries)) {
      (sorted.ammoCatalog as { entries: AmmoEntry[] }).entries = [
        ...entries,
      ].sort((a, b) => a.ammoId.localeCompare(b.ammoId));
    }
  }
  if (sorted.formationLayouts && typeof sorted.formationLayouts === 'object') {
    const layouts = (sorted.formationLayouts as { layouts?: LayoutEntry[] })
      .layouts;
    if (Array.isArray(layouts)) {
      (sorted.formationLayouts as { layouts: LayoutEntry[] }).layouts = [
        ...layouts,
      ].sort((a, b) => a.layoutId.localeCompare(b.layoutId));
    }
    const entries = (sorted.formationLayouts as { entries?: LayoutEntry[] })
      .entries;
    if (Array.isArray(entries)) {
      (sorted.formationLayouts as { entries: LayoutEntry[] }).entries = [
        ...entries,
      ].sort((a, b) => a.layoutId.localeCompare(b.layoutId));
    }
  }
  return sorted;
}
