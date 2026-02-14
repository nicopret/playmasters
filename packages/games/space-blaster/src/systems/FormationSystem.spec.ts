import type { ResolvedGameConfigV1 } from '@playmasters/types';
import { FormationSystem, type FormationEnemy } from './FormationSystem';
import { computeSlotLocalOffsets } from './formation-motion';

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
      { ammoId: 'ammo-a', spriteKey: 'ammo', projectileSpeed: 100, fireCooldownMs: 100 },
    ],
  },
  formationLayouts: {
    entries: [
      {
        layoutId: 'layout-a',
        rows: 1,
        columns: 3,
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

describe('FormationSystem', () => {
  it('keeps enemies aligned to shared slot transform', () => {
    const enemies: FormationEnemy[] = [];
    const resolvedConfig = createResolvedConfig();
    const system = new FormationSystem({
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

    system.spawnFormation({ enemyId: 'enemy-a', count: 3 });
    const offsets = computeSlotLocalOffsets(
      resolvedConfig.formationLayouts.entries[0],
      3,
    );
    const anchorOffset = offsets[0];

    for (const dtMs of [16, 33, 16, 33]) {
      system.update(dtMs);
      const anchorEnemy = enemies[0];
      expect(anchorEnemy).toBeDefined();
      for (const [index, slot] of offsets.entries()) {
        const enemy = enemies[index];
        expect(enemy).toBeDefined();
        expect((enemy?.x ?? 0) - (anchorEnemy?.x ?? 0)).toBeCloseTo(
          slot.localX - anchorOffset.localX,
          8,
        );
        expect((enemy?.y ?? 0) - (anchorEnemy?.y ?? 0)).toBeCloseTo(
          slot.localY - anchorOffset.localY,
          8,
        );
      }
    }
  });

  it('reverses direction and descends when crossing right bound', () => {
    const enemies: FormationEnemy[] = [];
    const resolvedConfig = createResolvedConfig();
    const system = new FormationSystem({
      ctx: {
        sdk: {} as never,
        resolvedConfig,
        configHash: resolvedConfig.configHash,
        mountedAt: '2026-02-14T00:00:00.000Z',
        hasPendingUpdate: false,
      },
      playBounds: () => ({ minX: 0, maxX: 100, minY: 0 }),
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

    system.spawnFormation({ enemyId: 'enemy-a', count: 3 });
    const before = system.getEnemyWorldPose('0:2');
    system.update(1000);
    const afterBounce = system.getEnemyWorldPose('0:2');
    system.update(100);
    const afterNextStep = system.getEnemyWorldPose('0:2');

    expect(before).toBeDefined();
    expect(afterBounce).toBeDefined();
    expect(afterNextStep).toBeDefined();
    expect(afterBounce?.x).toBeCloseTo(95, 8);
    expect(afterBounce?.y).toBeCloseTo(24, 8);
    expect((afterNextStep?.x ?? 0) < (afterBounce?.x ?? 0)).toBe(true);
  });
});
