import type { ResolvedGameConfigV1 } from './resolved-v1';

describe('ResolvedGameConfigV1', () => {
  it('is self-contained and includes all runtime domains', () => {
    const resolved: ResolvedGameConfigV1 = {
      gameId: 'space-blaster',
      env: 'dev',
      configHash: 'hash-1',
      versionId: 'v1',
      publishedAt: '2026-02-13T00:00:00.000Z',
      gameConfig: {
        defaultLives: 3,
        timing: {
          comboWindowMs: 500,
        },
      },
      levelConfigs: [
        {
          layoutId: 'layout-grid',
          enemyTypes: ['enemy-grunt'],
          speed: 50,
          waves: [
            {
              enemyId: 'enemy-grunt',
              count: 3,
              spawnDelayMs: 100,
            },
          ],
        },
      ],
      heroCatalog: {
        entries: [
          {
            heroId: 'hero-1',
            spriteKey: 'hero.sprite',
            defaultAmmoId: 'ammo-1',
            moveSpeed: 10,
            maxLives: 3,
            hitbox: {
              width: 12,
              height: 10,
            },
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
            ammoId: 'ammo-1',
            spriteKey: 'ammo.sprite',
            projectileSpeed: 240,
            fireCooldownMs: 120,
          },
        ],
      },
      formationLayouts: {
        entries: [
          {
            layoutId: 'layout-grid',
            rows: 3,
            columns: 4,
            spacing: {
              x: 10,
              y: 8,
            },
          },
        ],
      },
      scoreConfig: {
        baseEnemyScores: [{ enemyId: 'enemy-grunt', score: 100 }],
        combo: {
          enabled: true,
          minWindowMs: 300,
          resetOnPlayerHit: true,
          tiers: [{ minCount: 2, multiplier: 1.2, name: 'streak' }],
          windowMs: 500,
        },
        levelScoreMultiplier: {
          base: 1,
          max: 2,
          perLevel: 0.1,
        },
        waveClearBonus: {
          base: 50,
          perLifeBonus: 10,
        },
      },
    };

    expect(resolved.configHash).toBe('hash-1');
    expect(resolved.levelConfigs.length).toBe(1);
    expect(resolved.heroCatalog).toBeDefined();
    expect(resolved.enemyCatalog).toBeDefined();
    expect(resolved.ammoCatalog).toBeDefined();
    expect(resolved.formationLayouts).toBeDefined();
    expect(resolved.scoreConfig).toBeDefined();
  });
});
