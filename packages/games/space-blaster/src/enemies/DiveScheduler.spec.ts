import { DiveScheduler } from './DiveScheduler';
import { EnemyLocalState } from './EnemyLocalState';

type TestEnemy = { id: string; active: boolean };

type TestController = {
  state: EnemyLocalState;
  startDive: () => void;
};

const createController = (): TestController => {
  const controller: TestController = {
    state: EnemyLocalState.FORMATION,
    startDive: () => {
      if (controller.state !== EnemyLocalState.FORMATION) return;
      controller.state = EnemyLocalState.DIVING;
    },
  };
  return controller;
};

const createRng = (values: number[]): (() => number) => {
  let index = 0;
  return () => {
    const value = values[Math.min(index, values.length - 1)] ?? 0;
    index += 1;
    return value;
  };
};

describe('DiveScheduler', () => {
  it('respects attackTickMs timing and processes multiple ticks for large dt', () => {
    const enemy: TestEnemy = { id: 'e1', active: true };
    const controller = createController();
    const scheduler = new DiveScheduler({
      config: {
        attackTickMs: 200,
        diveChancePerTick: 1,
        maxConcurrentDivers: 2,
      },
      getCandidates: () => [
        { enemy, active: enemy.active, canDive: true, controller },
      ],
      randomFloat: createRng([0, 0, 0, 0]),
    });

    scheduler.update(100);
    expect(controller.state).toBe(EnemyLocalState.FORMATION);

    scheduler.update(100);
    expect(controller.state).toBe(EnemyLocalState.DIVING);

    controller.state = EnemyLocalState.FORMATION;
    scheduler.update(400);
    expect(controller.state).toBe(EnemyLocalState.DIVING);
  });

  it('respects diveChancePerTick', () => {
    const enemy: TestEnemy = { id: 'e1', active: true };
    const controllerNever = createController();
    const schedulerNever = new DiveScheduler({
      config: {
        attackTickMs: 100,
        diveChancePerTick: 0,
        maxConcurrentDivers: 1,
      },
      getCandidates: () => [
        {
          enemy,
          active: enemy.active,
          canDive: true,
          controller: controllerNever,
        },
      ],
      randomFloat: createRng([0]),
    });
    schedulerNever.update(1000);
    expect(controllerNever.state).toBe(EnemyLocalState.FORMATION);

    const controllerAlways = createController();
    const schedulerAlways = new DiveScheduler({
      config: {
        attackTickMs: 100,
        diveChancePerTick: 1,
        maxConcurrentDivers: 1,
      },
      getCandidates: () => [
        {
          enemy,
          active: enemy.active,
          canDive: true,
          controller: controllerAlways,
        },
      ],
      randomFloat: createRng([0, 0]),
    });
    schedulerAlways.update(100);
    expect(controllerAlways.state).toBe(EnemyLocalState.DIVING);
  });

  it('enforces maxConcurrentDivers strictly and allows new dives after return', () => {
    const enemies: TestEnemy[] = [
      { id: 'e1', active: true },
      { id: 'e2', active: true },
      { id: 'e3', active: true },
    ];
    const controllers = enemies.map(() => createController());
    const scheduler = new DiveScheduler({
      config: {
        attackTickMs: 100,
        diveChancePerTick: 1,
        maxConcurrentDivers: 2,
      },
      getCandidates: () =>
        enemies.map((enemy, index) => ({
          enemy,
          active: enemy.active,
          canDive: true,
          controller: controllers[index],
        })),
      randomFloat: createRng([
        0,
        0, // tick 1: chance pass, pick controller[0]
        0,
        0.1, // tick 2: chance pass, pick another formation controller
        0,
        0.9, // tick 3: chance pass, but cap reached
        0,
        0.9, // tick 4: after one returns, a new dive can start
      ]),
    });

    scheduler.update(300);
    expect(
      controllers.filter(
        (controller) => controller.state === EnemyLocalState.DIVING,
      ).length,
    ).toBe(2);

    controllers[0].state = EnemyLocalState.RETURNING;
    scheduler.update(100);
    expect(
      controllers.filter(
        (controller) => controller.state === EnemyLocalState.DIVING,
      ).length,
    ).toBe(2);
  });

  it('excludes detached/ineligible enemies from selection pool', () => {
    const enemies: TestEnemy[] = [
      { id: 'e1', active: true },
      { id: 'e2', active: true },
      { id: 'e3', active: true },
    ];
    const controllers = enemies.map(() => createController());
    controllers[0].state = EnemyLocalState.DIVING;
    const scheduler = new DiveScheduler({
      config: {
        attackTickMs: 100,
        diveChancePerTick: 1,
        maxConcurrentDivers: 3,
      },
      getCandidates: () => [
        {
          enemy: enemies[0],
          active: true,
          canDive: true,
          controller: controllers[0],
        },
        {
          enemy: enemies[1],
          active: true,
          canDive: false,
          controller: controllers[1],
        },
        {
          enemy: enemies[2],
          active: true,
          canDive: true,
          controller: controllers[2],
        },
      ],
      randomFloat: createRng([0, 0]),
    });

    scheduler.update(100);
    expect(controllers[0].state).toBe(EnemyLocalState.DIVING);
    expect(controllers[1].state).toBe(EnemyLocalState.FORMATION);
    expect(controllers[2].state).toBe(EnemyLocalState.DIVING);
  });

  it('does not advance scheduling while frozen (simDtMs=0)', () => {
    const enemy: TestEnemy = { id: 'e1', active: true };
    const controller = createController();
    const scheduler = new DiveScheduler({
      config: {
        attackTickMs: 100,
        diveChancePerTick: 1,
        maxConcurrentDivers: 1,
      },
      getCandidates: () => [
        { enemy, active: enemy.active, canDive: true, controller },
      ],
      randomFloat: createRng([0, 0]),
    });

    scheduler.update(0);
    expect(controller.state).toBe(EnemyLocalState.FORMATION);

    scheduler.update(100);
    expect(controller.state).toBe(EnemyLocalState.DIVING);
  });
});
