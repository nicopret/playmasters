import type { ResolvedSpaceBlasterBundleV1 } from '@playmasters/types';
import { resolveSpaceBlasterBundle } from './resolveSpaceBlasterBundle';

function makeBundle(): ResolvedSpaceBlasterBundleV1 {
  return {
    gameId: 'space-blaster',
    env: 'dev',
    configHash: 'cfg-123',
    versionHash: 'ver-123',
    versionId: 'v123',
    publishedAt: '2026-02-17T00:00:00.000Z',
    gameConfig: {
      defaultLives: 3,
      timing: { comboWindowMs: 500 },
    },
    levelConfigs: [
      {
        layoutId: 'layout-a',
        heroId: 'hero-1',
        enemyTypes: ['enemy-grunt'],
        waves: [{ enemyId: 'enemy-grunt', count: 2, spawnDelayMs: 0 }],
      } as unknown as ResolvedSpaceBlasterBundleV1['levelConfigs'][number],
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
          hp: 10,
          spriteKey: 'enemy.sprite',
        },
      ],
    },
    ammoCatalog: {
      entries: [
        {
          ammoId: 'ammo-laser',
          spriteKey: 'ammo.sprite',
          projectileSpeed: 300,
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
  };
}

describe('resolveSpaceBlasterBundle', () => {
  it('resolves level references to embedded layout and catalog entries', () => {
    const result = resolveSpaceBlasterBundle(makeBundle());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const level = result.resolved.levelConfigs[0] as unknown as {
      formationLayout: { layoutId: string };
      waves: Array<{ enemyId: string; enemy: { enemyId: string } }>;
      hero: { heroId: string };
      heroAmmo: { ammoId: string };
    };
    expect(level.formationLayout.layoutId).toBe('layout-a');
    expect(level.waves[0].enemyId).toBe('enemy-grunt');
    expect(level.waves[0].enemy.enemyId).toBe('enemy-grunt');
    expect(level.hero.heroId).toBe('hero-1');
    expect(level.heroAmmo.ammoId).toBe('ammo-laser');
    expect(result.resolved.configHash).toBe('cfg-123');
    expect(result.resolved.versionHash).toBe('ver-123');
  });

  it('returns safe missing layout error', () => {
    const bundle = makeBundle();
    bundle.levelConfigs[0].layoutId = 'missing-layout';
    const result = resolveSpaceBlasterBundle(bundle);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('MISSING_LAYOUT');
    expect(result.error.details.domain).toBe('FormationLayouts');
    expect(result.error.details.id).toBe('missing-layout');
    expect(result.error.details.fieldPath).toBe('levelConfigs[0].layoutId');
  });

  it('returns safe missing enemy error', () => {
    const bundle = makeBundle();
    bundle.levelConfigs[0].waves = [{ enemyId: 'missing-enemy', count: 1 }];
    const result = resolveSpaceBlasterBundle(bundle);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('MISSING_ENEMY');
    expect(result.error.details.domain).toBe('EnemyCatalog');
    expect(result.error.details.id).toBe('missing-enemy');
    expect(result.error.details.fieldPath).toBe(
      'levelConfigs[0].waves[0].enemyId',
    );
  });

  it('returns safe missing hero error', () => {
    const bundle = makeBundle();
    (bundle.levelConfigs[0] as { heroId?: string }).heroId = 'missing-hero';
    const result = resolveSpaceBlasterBundle(bundle);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('MISSING_HERO');
    expect(result.error.details.domain).toBe('HeroCatalog');
    expect(result.error.details.id).toBe('missing-hero');
    expect(result.error.details.fieldPath).toBe('levelConfigs[0].heroId');
  });

  it('returns safe missing ammo error when hero default ammo is missing', () => {
    const bundle = makeBundle();
    bundle.ammoCatalog.entries = [];
    const result = resolveSpaceBlasterBundle(bundle);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('MISSING_AMMO');
    expect(result.error.details.domain).toBe('AmmoCatalog');
    expect(result.error.details.id).toBe('ammo-laser');
    expect(result.error.details.fieldPath).toBe(
      'levelConfigs[0].heroId.defaultAmmoId',
    );
  });
});
