import type { PublishedBundle } from './bundleStore';
import { createRuntimeResolvedBundleCache } from './runtimeResolvedBundleCache';
import { resolveRuntimeBundleResponse } from './runtimeResolvedBundleService';

function makePublishedBundle(
  versionId: string,
  enemyHp: number,
): PublishedBundle {
  return {
    env: 'dev',
    versionId,
    configHash: `${versionId}-cfg`,
    versionHash: `${versionId}-ver`,
    createdAt: '2026-02-17T00:00:00.000Z',
    bundle: {
      gameConfig: { defaultLives: 3, timing: { comboWindowMs: 600 } },
      levelConfigs: [
        {
          layoutId: 'layout-a',
          heroId: 'hero-1',
          enemyTypes: ['enemy-grunt'],
          waves: [{ enemyId: 'enemy-grunt', count: 2, spawnDelayMs: 0 }],
        },
      ],
      heroCatalog: {
        entries: [
          {
            heroId: 'hero-1',
            spriteKey: 'hero.sprite',
            defaultAmmoId: 'ammo-laser',
            moveSpeed: 200,
            maxLives: 3,
            hitbox: { width: 10, height: 10 },
          },
        ],
      },
      enemyCatalog: {
        entries: [
          {
            enemyId: 'enemy-grunt',
            hp: enemyHp,
            spriteKey: 'enemy.sprite',
          },
        ],
      },
      ammoCatalog: {
        entries: [
          {
            ammoId: 'ammo-laser',
            spriteKey: 'ammo.sprite',
            projectileSpeed: 320,
            fireCooldownMs: 100,
          },
        ],
      },
      formationLayouts: {
        entries: [
          {
            layoutId: 'layout-a',
            rows: 2,
            columns: 2,
            spacing: { x: 10, y: 10 },
          },
        ],
      },
      scoreConfig: {
        baseEnemyScores: [{ enemyId: 'enemy-grunt', score: 10 }],
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
    },
  };
}

describe('resolveRuntimeBundleResponse caching', () => {
  it('caches resolved bundle for same pointer version', async () => {
    const cache = createRuntimeResolvedBundleCache({
      maxEntries: 10,
      ttlMs: 100_000,
      now: () => 1_000,
    });
    const getPointer = jest.fn().mockResolvedValue({
      env: 'dev',
      currentVersionId: 'vA',
    });
    const getPublishedBundle = jest
      .fn()
      .mockResolvedValue(makePublishedBundle('vA', 10));

    const first = await resolveRuntimeBundleResponse({
      gameId: 'space-blaster',
      env: 'dev',
      getPointer,
      getPublishedBundle,
      cache,
    });
    const second = await resolveRuntimeBundleResponse({
      gameId: 'space-blaster',
      env: 'dev',
      getPointer,
      getPublishedBundle,
      cache,
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(first.response.versionId).toBe('vA');
    expect(second.response.versionId).toBe('vA');
    expect(getPublishedBundle).toHaveBeenCalledTimes(1);
  });

  it('returns fresh bundle after pointer changes version', async () => {
    const cache = createRuntimeResolvedBundleCache({
      maxEntries: 10,
      ttlMs: 100_000,
      now: () => 1_000,
    });
    let pointerVersion = 'vA';
    const getPointer = jest.fn().mockImplementation(async () => ({
      env: 'dev',
      currentVersionId: pointerVersion,
    }));
    const getPublishedBundle = jest.fn(
      async (_env: string, versionId: string) =>
        versionId === 'vA'
          ? makePublishedBundle('vA', 10)
          : makePublishedBundle('vB', 99),
    );

    const first = await resolveRuntimeBundleResponse({
      gameId: 'space-blaster',
      env: 'dev',
      getPointer,
      getPublishedBundle,
      cache,
    });
    pointerVersion = 'vB';
    const second = await resolveRuntimeBundleResponse({
      gameId: 'space-blaster',
      env: 'dev',
      getPointer,
      getPublishedBundle,
      cache,
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.response.versionId).toBe('vA');
    expect(second.response.versionId).toBe('vB');
    expect(getPublishedBundle).toHaveBeenCalledTimes(2);
    const secondEnemy = (
      second.response.bundle.enemyCatalog.entries[0] as { hp: number }
    ).hp;
    expect(secondEnemy).toBe(99);
  });

  it('cache invalidation forces re-resolve for same pointer version', async () => {
    const cache = createRuntimeResolvedBundleCache({
      maxEntries: 10,
      ttlMs: 100_000,
      now: () => 1_000,
    });
    const getPointer = jest.fn().mockResolvedValue({
      env: 'dev',
      currentVersionId: 'vA',
    });
    const getPublishedBundle = jest
      .fn()
      .mockResolvedValue(makePublishedBundle('vA', 10));

    const first = await resolveRuntimeBundleResponse({
      gameId: 'space-blaster',
      env: 'dev',
      getPointer,
      getPublishedBundle,
      cache,
    });
    expect(first.ok).toBe(true);
    cache.invalidateGame('space-blaster', 'dev');

    const second = await resolveRuntimeBundleResponse({
      gameId: 'space-blaster',
      env: 'dev',
      getPointer,
      getPublishedBundle,
      cache,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.cacheHit).toBe(false);
    expect(getPublishedBundle).toHaveBeenCalledTimes(2);
  });
});
