import type { ResolvedGameConfigV1 } from '@playmasters/types';
import { EnemyLocalState } from '../enemies/EnemyLocalState';
import { EnemyFireSystem } from './EnemyFireSystem';
import { FormationSystem, type FormationEnemy } from './FormationSystem';

const createResolvedConfig = (): ResolvedGameConfigV1 => ({
  configHash: 'hash',
  gameConfig: {
    defaultLives: 3,
    timing: { comboWindowMs: 600 },
  },
  levelConfigs: [
    {
      layoutId: 'layout-a',
      speed: 40,
      shooting: 100,
      waves: [{ enemyId: 'enemy-a', count: 3 }],
    },
  ],
  heroCatalog: {
    entries: [
      {
        heroId: 'hero-a',
        spriteKey: 'hero',
        defaultAmmoId: 'ammo-a',
        moveSpeed: 100,
        maxLives: 3,
        hitbox: { width: 10, height: 10 },
      },
    ],
  },
  enemyCatalog: {
    entries: [{ enemyId: 'enemy-a', hp: 1, spriteKey: 'enemy' }],
  },
  ammoCatalog: {
    entries: [
      {
        ammoId: 'ammo-a',
        spriteKey: 'ammo',
        projectileSpeed: 100,
        fireCooldownMs: 100,
      },
    ],
  },
  formationLayouts: {
    entries: [
      {
        layoutId: 'layout-a',
        rows: 3,
        columns: 1,
        spacing: { x: 20, y: 12 },
        compact: false,
      },
    ],
  },
  scoreConfig: {
    baseEnemyScores: [],
    combo: {
      enabled: false,
      minWindowMs: 0,
      resetOnPlayerHit: false,
      tiers: [],
      windowMs: 0,
    },
    levelScoreMultiplier: { base: 1, max: 1, perLevel: 0 },
    waveClearBonus: { base: 0, perLifeBonus: 0 },
  },
});

const createFormation = () => {
  const enemies: FormationEnemy[] = [];
  const resolvedConfig = createResolvedConfig();
  const formation = new FormationSystem({
    ctx: {
      sdk: {} as never,
      resolvedConfig,
      configHash: resolvedConfig.configHash,
      mountedAt: '2026-02-14T00:00:00.000Z',
      hasPendingUpdate: false,
    },
    playBounds: () => ({ minX: 0, maxX: 200, minY: 0 }),
    enemyManager: {
      spawnEnemy: () => {
        const enemy: FormationEnemy = {
          active: true,
          x: 0,
          y: 0,
          width: 10,
          setPosition: (x: number, y: number) => {
            enemy.x = x;
            enemy.y = y;
          },
        };
        enemies.push(enemy);
        return enemy;
      },
      getActiveEnemies: () => enemies.filter((enemy) => enemy.active),
      clearEnemies: () => {
        enemies.splice(0, enemies.length);
      },
    },
  });

  formation.spawnFormation({ enemyId: 'enemy-a', count: 3 });
  formation.update(0);
  return { formation, enemies };
};

describe('EnemyFireSystem', () => {
  it('updates firing shooter immediately as lowest enemy dies', () => {
    const { formation, enemies } = createFormation();
    const shots: Array<{ x: number; y: number; directionY: number }> = [];
    const fireSystem = new EnemyFireSystem({
      formation,
      weapon: {
        tryFire: (x, y, directionY) => {
          shots.push({ x, y, directionY });
          return true;
        },
      },
      fireChancePerSecond: 1,
      randomFloat: () => 0,
      muzzleOffsetY: 0,
    });

    const lowest = enemies[2];
    fireSystem.update(1000);
    expect(shots.at(-1)?.x).toBeCloseTo(lowest.x, 8);
    expect(shots.at(-1)?.y).toBeCloseTo(lowest.y, 8);

    lowest.active = false;
    formation.onEnemyDeath(lowest);
    const nextLowest = enemies[1];
    fireSystem.update(1000);
    expect(shots.at(-1)?.x).toBeCloseTo(nextLowest.x, 8);
    expect(shots.at(-1)?.y).toBeCloseTo(nextLowest.y, 8);
  });

  it('does not fire when a column has no alive occupied shooter', () => {
    const { formation, enemies } = createFormation();
    const shots: Array<{ x: number; y: number; directionY: number }> = [];
    const fireSystem = new EnemyFireSystem({
      formation,
      weapon: {
        tryFire: (x, y, directionY) => {
          shots.push({ x, y, directionY });
          return true;
        },
      },
      fireChancePerSecond: 1,
      randomFloat: () => 0,
      muzzleOffsetY: 0,
    });

    for (const enemy of enemies) {
      enemy.active = false;
      formation.onEnemyDeath(enemy);
    }
    expect(formation.getEligibleShooterInColumn(0)).toBeNull();
    expect(fireSystem.update(1000)).toBe(false);
    expect(shots).toHaveLength(0);
  });

  it('excludes detached divers until they reattach', () => {
    const { formation, enemies } = createFormation();
    const shots: Array<{ x: number; y: number; directionY: number }> = [];
    const fireSystem = new EnemyFireSystem({
      formation,
      weapon: {
        tryFire: (x, y, directionY) => {
          shots.push({ x, y, directionY });
          return true;
        },
      },
      fireChancePerSecond: 1,
      randomFloat: () => 0,
      muzzleOffsetY: 0,
    });

    const lowest = enemies[2];
    const nextLowest = enemies[1];
    formation.setEnemyLocalState(lowest, EnemyLocalState.DIVING);
    fireSystem.update(1000);
    expect(shots.at(-1)?.x).toBeCloseTo(nextLowest.x, 8);
    expect(shots.at(-1)?.y).toBeCloseTo(nextLowest.y, 8);

    formation.setEnemyLocalState(lowest, EnemyLocalState.FORMATION);
    fireSystem.update(1000);
    expect(shots.at(-1)?.x).toBeCloseTo(lowest.x, 8);
    expect(shots.at(-1)?.y).toBeCloseTo(lowest.y, 8);
  });
});
