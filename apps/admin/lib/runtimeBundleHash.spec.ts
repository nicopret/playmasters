import {
  computeConfigHashForBundle,
  computeVersionHashForBundle,
  resolveBundleHashes,
  sha256HexFromValue,
  stableStringify,
} from './runtimeBundleHash';

describe('runtimeBundleHash', () => {
  it('stableStringify is deterministic across object key order', () => {
    const a = { a: 1, b: { x: 2, y: 3 } };
    const b = { b: { y: 3, x: 2 }, a: 1 };

    expect(stableStringify(a)).toBe(stableStringify(b));
    expect(sha256HexFromValue(a)).toBe(sha256HexFromValue(b));
  });

  it('hash changes when nested content changes', () => {
    const base = {
      gameConfig: { defaultLives: 3 },
      enemyCatalog: { entries: [{ enemyId: 'grunt', hp: 10 }] },
    };
    const changed = {
      gameConfig: { defaultLives: 3 },
      enemyCatalog: { entries: [{ enemyId: 'grunt', hp: 11 }] },
    };

    expect(computeConfigHashForBundle(base)).not.toBe(
      computeConfigHashForBundle(changed),
    );
    expect(computeVersionHashForBundle(base)).not.toBe(
      computeVersionHashForBundle(changed),
    );
  });

  it('hash computation excludes configHash/versionHash self fields', () => {
    const base = {
      levelConfigs: [{ layoutId: 'layout-a' }],
      enemyCatalog: { entries: [{ enemyId: 'grunt', hp: 10 }] },
    };
    const withSelfFields = {
      ...base,
      configHash: 'abc',
      versionHash: 'def',
    };

    expect(computeConfigHashForBundle(base)).toBe(
      computeConfigHashForBundle(withSelfFields),
    );
    expect(computeVersionHashForBundle(base)).toBe(
      computeVersionHashForBundle(withSelfFields),
    );
  });

  it('uses published hashes when present and computes fallback when missing', () => {
    const bundle = {
      levelConfigs: [{ layoutId: 'layout-a', waves: [{ enemyId: 'grunt' }] }],
      enemyCatalog: { entries: [{ enemyId: 'grunt', hp: 10 }] },
      heroCatalog: { entries: [{ heroId: 'hero', defaultAmmoId: 'ammo' }] },
      ammoCatalog: { entries: [{ ammoId: 'ammo' }] },
      formationLayouts: { entries: [{ layoutId: 'layout-a' }] },
      gameConfig: { defaultLives: 3, timing: { comboWindowMs: 600 } },
      scoreConfig: {
        baseEnemyScores: [{ enemyId: 'grunt', score: 10 }],
        combo: {
          enabled: true,
          minWindowMs: 100,
          resetOnPlayerHit: true,
          tiers: [{ minCount: 1, multiplier: 1, name: 'tier-1' }],
          windowMs: 500,
        },
        levelScoreMultiplier: { base: 1, max: 2, perLevel: 0.1 },
        waveClearBonus: { base: 10, perLifeBonus: 1 },
      },
    };

    expect(
      resolveBundleHashes({
        bundle,
        publishedConfigHash: 'published-config',
        publishedVersionHash: 'published-version',
      }),
    ).toEqual({
      configHash: 'published-config',
      versionHash: 'published-version',
    });

    const fallback = resolveBundleHashes({ bundle });
    expect(fallback.configHash).toMatch(/^[a-f0-9]{64}$/);
    expect(fallback.versionHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
