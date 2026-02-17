import type { SpaceBlasterRuntimeResolverResponseV1 } from '@playmasters/types';
import {
  buildResolvedBundleCacheKey,
  createRuntimeResolvedBundleCache,
} from './runtimeResolvedBundleCache';

function makeResponse(
  versionId: string,
): SpaceBlasterRuntimeResolverResponseV1 {
  return {
    versionId,
    configHash: `${versionId}-cfg`,
    bundle: {
      configHash: `${versionId}-cfg`,
      versionHash: `${versionId}-ver`,
      versionId,
      gameConfig: { defaultLives: 3, timing: { comboWindowMs: 500 } },
      levelConfigs: [],
      heroCatalog: { entries: [] },
      enemyCatalog: { entries: [] },
      ammoCatalog: { entries: [] },
      formationLayouts: { entries: [] },
      scoreConfig: {
        baseEnemyScores: [],
        combo: {
          enabled: true,
          minWindowMs: 100,
          resetOnPlayerHit: true,
          tiers: [],
          windowMs: 500,
        },
        levelScoreMultiplier: { base: 1, max: 2, perLevel: 0.1 },
        waveClearBonus: { base: 10, perLifeBonus: 1 },
      },
    },
  };
}

describe('RuntimeResolvedBundleCache', () => {
  it('evicts oldest entry when maxEntries is exceeded', () => {
    let now = 1_000;
    const cache = createRuntimeResolvedBundleCache({
      maxEntries: 2,
      ttlMs: 10_000,
      now: () => now,
    });

    cache.set({
      key: 'k1',
      gameId: 'space-blaster',
      env: 'dev',
      versionId: 'v1',
      value: makeResponse('v1'),
    });
    cache.set({
      key: 'k2',
      gameId: 'space-blaster',
      env: 'dev',
      versionId: 'v2',
      value: makeResponse('v2'),
    });
    now += 1;
    cache.set({
      key: 'k3',
      gameId: 'space-blaster',
      env: 'dev',
      versionId: 'v3',
      value: makeResponse('v3'),
    });

    expect(cache.get('k1')).toBeUndefined();
    expect(cache.get('k2')?.versionId).toBe('v2');
    expect(cache.get('k3')?.versionId).toBe('v3');
  });

  it('expires entries based on ttl', () => {
    let now = 1_000;
    const cache = createRuntimeResolvedBundleCache({
      maxEntries: 5,
      ttlMs: 100,
      now: () => now,
    });
    cache.set({
      key: 'k1',
      gameId: 'space-blaster',
      env: 'dev',
      versionId: 'v1',
      value: makeResponse('v1'),
    });

    expect(cache.get('k1')?.versionId).toBe('v1');
    now += 200;
    expect(cache.get('k1')).toBeUndefined();
  });

  it('invalidateGame removes only target game/env keys', () => {
    const cache = createRuntimeResolvedBundleCache({
      maxEntries: 10,
      ttlMs: 10_000,
      now: () => 1_000,
    });
    const keyDevA = buildResolvedBundleCacheKey('space-blaster', 'dev', 'va');
    const keyDevB = buildResolvedBundleCacheKey('space-blaster', 'dev', 'vb');
    const keyProdA = buildResolvedBundleCacheKey('space-blaster', 'prod', 'va');
    const keyOther = buildResolvedBundleCacheKey('other-game', 'dev', 'va');

    cache.set({
      key: keyDevA,
      gameId: 'space-blaster',
      env: 'dev',
      versionId: 'va',
      value: makeResponse('va'),
    });
    cache.set({
      key: keyDevB,
      gameId: 'space-blaster',
      env: 'dev',
      versionId: 'vb',
      value: makeResponse('vb'),
    });
    cache.set({
      key: keyProdA,
      gameId: 'space-blaster',
      env: 'prod',
      versionId: 'va',
      value: makeResponse('va'),
    });
    cache.set({
      key: keyOther,
      gameId: 'other-game',
      env: 'dev',
      versionId: 'va',
      value: makeResponse('va'),
    });

    cache.invalidateGame('space-blaster', 'dev');

    expect(cache.get(keyDevA)).toBeUndefined();
    expect(cache.get(keyDevB)).toBeUndefined();
    expect(cache.get(keyProdA)?.versionId).toBe('va');
    expect(cache.get(keyOther)?.versionId).toBe('va');
  });

  it('tracks hit/miss counters', () => {
    const cache = createRuntimeResolvedBundleCache({
      maxEntries: 10,
      ttlMs: 10_000,
      now: () => 1_000,
    });
    cache.set({
      key: 'k1',
      gameId: 'space-blaster',
      env: 'dev',
      versionId: 'v1',
      value: makeResponse('v1'),
    });

    expect(cache.get('k1')?.versionId).toBe('v1');
    expect(cache.get('missing')).toBeUndefined();
    expect(cache.stats()).toEqual({
      entries: 1,
      hits: 1,
      misses: 1,
    });
  });
});
