import { createHash } from 'crypto';

// Canonicalize a JS value by sorting object keys recursively
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => canonicalize(v));
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
    );
    const obj: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      obj[k] = canonicalize(v);
    }
    return obj;
  }
  return value;
}

export function hashCanonical(value: unknown): string {
  const canonical = canonicalize(value);
  const json = JSON.stringify(canonical);
  return createHash('sha256').update(json).digest('hex');
}

type LayoutEntry = { layoutId: string; [k: string]: unknown };
type EnemyEntry = { enemyId: string; [k: string]: unknown };
type HeroEntry = { heroId: string; [k: string]: unknown };
type AmmoEntry = { ammoId: string; [k: string]: unknown };

export function sortBundleDomains(bundle: Record<string, unknown>): Record<string, unknown> {
  const sorted = { ...bundle };
  if (sorted['levels'] && typeof sorted['levels'] === 'object' && !Array.isArray(sorted['levels'])) {
    sorted['levels'] = Object.entries(sorted['levels'] as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .reduce((acc, [k, v]) => {
        acc[k] = v;
        return acc;
      }, {} as Record<string, unknown>);
  }
  if (sorted['enemyCatalog'] && typeof sorted['enemyCatalog'] === 'object') {
    const entries = (sorted['enemyCatalog'] as { entries?: EnemyEntry[] }).entries;
    if (Array.isArray(entries)) {
      (sorted['enemyCatalog'] as { entries: EnemyEntry[] }).entries = [...entries].sort((a, b) =>
        a.enemyId.localeCompare(b.enemyId),
      );
    }
  }
  if (sorted['heroCatalog'] && typeof sorted['heroCatalog'] === 'object') {
    const entries = (sorted['heroCatalog'] as { entries?: HeroEntry[] }).entries;
    if (Array.isArray(entries)) {
      (sorted['heroCatalog'] as { entries: HeroEntry[] }).entries = [...entries].sort((a, b) =>
        a.heroId.localeCompare(b.heroId),
      );
    }
  }
  if (sorted['ammoCatalog'] && typeof sorted['ammoCatalog'] === 'object') {
    const entries = (sorted['ammoCatalog'] as { entries?: AmmoEntry[] }).entries;
    if (Array.isArray(entries)) {
      (sorted['ammoCatalog'] as { entries: AmmoEntry[] }).entries = [...entries].sort((a, b) =>
        a.ammoId.localeCompare(b.ammoId),
      );
    }
  }
  if (sorted['formationLayouts'] && typeof sorted['formationLayouts'] === 'object') {
    const layouts = (sorted['formationLayouts'] as { layouts?: LayoutEntry[] }).layouts;
    if (Array.isArray(layouts)) {
      (sorted['formationLayouts'] as { layouts: LayoutEntry[] }).layouts = [...layouts].sort((a, b) =>
        a.layoutId.localeCompare(b.layoutId),
      );
    }
    const entries = (sorted['formationLayouts'] as { entries?: LayoutEntry[] }).entries;
    if (Array.isArray(entries)) {
      (sorted['formationLayouts'] as { entries: LayoutEntry[] }).entries = [...entries].sort((a, b) =>
        a.layoutId.localeCompare(b.layoutId),
      );
    }
  }
  return sorted;
}

export function computeConfigHash(bundle: Record<string, unknown>): string {
  return hashCanonical(sortBundleDomains(bundle));
}

export type BundleWithHash<T = unknown> = T & { configHash: string };
