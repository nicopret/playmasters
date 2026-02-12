import { computeConfigHash, hashCanonical } from './hash';

const base = require('../validators/__fixtures__/bundle-base.json');

describe('config hash', () => {
  it('is stable for identical content with different key order', () => {
    const a = { x: 1, y: { b: 2, a: 3 } };
    const b = { y: { a: 3, b: 2 }, x: 1 };
    expect(hashCanonical(a)).toBe(hashCanonical(b));
  });

  it('changes when nested content changes', () => {
    const a = { x: 1, y: { a: 1 } };
    const b = { x: 1, y: { a: 2 } };
    expect(hashCanonical(a)).not.toBe(hashCanonical(b));
  });

  it('bundle hash stable regardless of map insertion order', () => {
    const a = { levelA: { hp: 1 }, levelB: { hp: 2 } };
    const b = { levelB: { hp: 2 }, levelA: { hp: 1 } };
    expect(hashCanonical(a)).toBe(hashCanonical(b));
  });

  it('bundle hash changes when a domain changes', () => {
    const bundleA = JSON.parse(JSON.stringify(base));
    const bundleB = JSON.parse(JSON.stringify(base));
    bundleB.enemyCatalog.entries[0].hp += 1;
    expect(computeConfigHash(bundleA)).not.toBe(computeConfigHash(bundleB));
  });

  it('sortBundleDomains sorts catalogs and layouts deterministically', () => {
    const bundle = JSON.parse(JSON.stringify(base));
    const shuffled = JSON.parse(JSON.stringify(base));
    shuffled.enemyCatalog.entries.reverse();
    shuffled.heroCatalog.entries.reverse();
    shuffled.ammoCatalog.entries.reverse();
    shuffled.formationLayouts.entries.reverse?.();
    const h1 = computeConfigHash(bundle);
    const h2 = computeConfigHash(shuffled);
    expect(h1).toBe(h2);
  });
});
