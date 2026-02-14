import type { ResolvedGameConfigV1 } from '@playmasters/types';
import { FormationSystem, type FormationEnemy } from '../systems/FormationSystem';
import { EnemyController } from './EnemyController';
import { EnemyLocalState } from './EnemyLocalState';

const createResolvedConfig = (): ResolvedGameConfigV1 => ({
  configHash: 'hash',
  gameConfig: {
    defaultLives: 3,
    timing: { comboWindowMs: 600 },
  },
  levelConfigs: [
    {
      layoutId: 'layout-a',
      speed: 0,
      waves: [{ enemyId: 'enemy-a', count: 1, spawnDelayMs: 200 }],
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
        rows: 1,
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

describe('EnemyController', () => {
  it('does not self-steer in FORMATION', () => {
    const enemy = {
      active: true,
      x: 10,
      y: 20,
      setPosition(x: number, y: number) {
        this.x = x;
        this.y = y;
      },
    };
    const controller = new EnemyController({
      enemy,
      getReservedSlotPose: () => ({ x: 10, y: 20 }),
      diveSpeedPxPerSecond: 100,
      returnSpeedPxPerSecond: 100,
      diveDurationMs: 200,
      arrivalThresholdPx: 2,
    });

    controller.update(100);
    expect(controller.state).toBe(EnemyLocalState.FORMATION);
    expect(enemy.x).toBe(10);
    expect(enemy.y).toBe(20);
  });

  it('dives then returns to reserved slot and reattaches', () => {
    const enemy = {
      active: true,
      x: 0,
      y: 0,
      setPosition(x: number, y: number) {
        this.x = x;
        this.y = y;
      },
    };
    const target = { x: 0, y: 0 };
    const stateHistory: EnemyLocalState[] = [];
    const controller = new EnemyController({
      enemy,
      getReservedSlotPose: () => target,
      onLocalStateChanged: (state) => stateHistory.push(state),
      diveSpeedPxPerSecond: 100,
      returnSpeedPxPerSecond: 200,
      diveDurationMs: 200,
      arrivalThresholdPx: 2,
    });

    controller.startDive();
    controller.update(100);
    expect(enemy.y).toBeGreaterThan(0);
    expect(controller.state).toBe(EnemyLocalState.DIVING);

    controller.update(100);
    expect(controller.state).toBe(EnemyLocalState.RETURNING);
    controller.update(1000);
    expect(controller.state).toBe(EnemyLocalState.FORMATION);
    expect(enemy.x).toBeCloseTo(target.x, 8);
    expect(enemy.y).toBeCloseTo(target.y, 8);
    expect(stateHistory).toEqual([
      EnemyLocalState.DIVING,
      EnemyLocalState.RETURNING,
      EnemyLocalState.FORMATION,
    ]);
  });

  it('clears slot reservation on death while diving', () => {
    const enemies: FormationEnemy[] = [];
    const resolvedConfig = createResolvedConfig();
    const formationSystem = new FormationSystem({
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
            setPosition(x: number, y: number) {
              this.x = x;
              this.y = y;
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

    formationSystem.spawnFormation({ enemyId: 'enemy-a', count: 1 });
    const enemy = enemies[0];
    const reservedSlotId = formationSystem.getReservedSlotId(enemy);
    expect(reservedSlotId).toBeDefined();

    const controller = new EnemyController({
      enemy,
      getReservedSlotPose: () =>
        formationSystem.getReservedSlotWorldPose(enemy),
      onLocalStateChanged: (state) =>
        formationSystem.setEnemyLocalState(enemy, state),
      diveSpeedPxPerSecond: 100,
      returnSpeedPxPerSecond: 100,
      diveDurationMs: 200,
      arrivalThresholdPx: 2,
    });

    controller.startDive();
    controller.update(100);
    expect(formationSystem.getEnemyLocalState(enemy)).toBe(EnemyLocalState.DIVING);

    enemy.active = false;
    controller.update(0);
    formationSystem.onEnemyDeath(enemy);

    expect(formationSystem.getReservedSlotId(enemy)).toBeUndefined();
    expect(formationSystem.getManagedEnemies()).toHaveLength(0);
  });

  it('detaches on dive and reattaches to reserved slot on return', () => {
    const enemies: FormationEnemy[] = [];
    const resolvedConfig = createResolvedConfig();
    const formationSystem = new FormationSystem({
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
            setPosition(x: number, y: number) {
              this.x = x;
              this.y = y;
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

    formationSystem.spawnFormation({ enemyId: 'enemy-a', count: 1 });
    const enemy = enemies[0];
    const slotBeforeDive = formationSystem.getReservedSlotWorldPose(enemy);
    expect(slotBeforeDive).toBeDefined();

    const controller = new EnemyController({
      enemy,
      getReservedSlotPose: () =>
        formationSystem.getReservedSlotWorldPose(enemy),
      onLocalStateChanged: (state) =>
        formationSystem.setEnemyLocalState(enemy, state),
      diveSpeedPxPerSecond: 100,
      returnSpeedPxPerSecond: 200,
      diveDurationMs: 100,
      arrivalThresholdPx: 2,
    });

    controller.startDive();
    controller.update(50);
    const detachedY = enemy.y;
    formationSystem.update(16);
    expect(enemy.y).toBeCloseTo(detachedY, 8);
    expect(formationSystem.getEnemyLocalState(enemy)).toBe(EnemyLocalState.DIVING);

    controller.update(60);
    controller.update(500);
    formationSystem.update(16);
    expect(formationSystem.getEnemyLocalState(enemy)).toBe(
      EnemyLocalState.FORMATION,
    );
    const slotAfterReturn = formationSystem.getReservedSlotWorldPose(enemy);
    expect(enemy.x).toBeCloseTo(slotAfterReturn?.x ?? 0, 8);
    expect(enemy.y).toBeCloseTo(slotAfterReturn?.y ?? 0, 8);
  });
});
