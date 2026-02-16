import {
  computeEligibleShootersByColumn,
  ShooterEligibility,
} from './ShooterEligibility';

type Enemy = { id: string };

const createEnemy = (id: string): Enemy => ({ id });

describe('ShooterEligibility', () => {
  it('1) lowest alive per column selected correctly', () => {
    const col0Row0 = createEnemy('c0r0');
    const col0Row2 = createEnemy('c0r2');
    const col0DetachedRow3 = createEnemy('c0r3-detached');
    const col1Row1 = createEnemy('c1r1');
    const col1DeadRow3 = createEnemy('c1r3-dead');
    const col2Row2 = createEnemy('c2r2');
    const slots = [
      {
        enemy: col0Row0,
        row: 0,
        column: 0,
        alive: true,
        inFormation: true,
      },
      {
        enemy: col0Row2,
        row: 2,
        column: 0,
        alive: true,
        inFormation: true,
      },
      {
        enemy: col0DetachedRow3,
        row: 3,
        column: 0,
        alive: true,
        inFormation: false,
      },
      {
        enemy: col1Row1,
        row: 1,
        column: 1,
        alive: true,
        inFormation: true,
      },
      {
        enemy: col1DeadRow3,
        row: 3,
        column: 1,
        alive: false,
        inFormation: true,
      },
      {
        enemy: col2Row2,
        row: 2,
        column: 2,
        alive: true,
        inFormation: true,
      },
    ];

    const pureResult = computeEligibleShootersByColumn(slots);
    expect(pureResult.get(0)).toBe(col0Row2);
    expect(pureResult.get(1)).toBe(col1Row1);
    expect(pureResult.get(2)).toBe(col2Row2);
    expect(pureResult.has(3)).toBe(false);

    const tracker = new ShooterEligibility<Enemy>({
      getSlots: () => slots,
    });

    tracker.rebuildFromFormation();

    expect(tracker.getEligibleInColumn(0)).toBe(col0Row2);
    expect(tracker.getEligibleInColumn(1)).toBe(col1Row1);
    expect(tracker.getEligibleInColumn(2)).toBe(col2Row2);
    expect(tracker.getEligibleInColumn(3)).toBeNull();
    expect(tracker.getAllEligible()).toEqual(
      new Set([col0Row2, col1Row1, col2Row2]),
    );
  });

  it('updates immediately when lowest shooter dies', () => {
    const col0Row1 = createEnemy('c0r1');
    const col0Row2 = createEnemy('c0r2');
    const slots = [
      {
        enemy: col0Row1,
        row: 1,
        column: 0,
        alive: true,
        inFormation: true,
      },
      {
        enemy: col0Row2,
        row: 2,
        column: 0,
        alive: true,
        inFormation: true,
      },
    ];
    const tracker = new ShooterEligibility<Enemy>({
      getSlots: () => slots,
    });
    tracker.rebuildFromFormation();
    expect(tracker.getEligibleInColumn(0)).toBe(col0Row2);

    slots[1].alive = false;
    tracker.onEnemyDied();

    expect(tracker.getEligibleInColumn(0)).toBe(col0Row1);
    expect(tracker.isEligible(col0Row1)).toBe(true);
    expect(tracker.isEligible(col0Row2)).toBe(false);
  });

  it('2) diver removed from eligibility while detached', () => {
    const col0Row1 = createEnemy('c0r1');
    const col0Row2 = createEnemy('c0r2');
    const slots = [
      {
        enemy: col0Row1,
        row: 1,
        column: 0,
        alive: true,
        inFormation: true,
      },
      {
        enemy: col0Row2,
        row: 2,
        column: 0,
        alive: true,
        inFormation: true,
      },
    ];
    const tracker = new ShooterEligibility<Enemy>({
      getSlots: () => slots,
    });
    tracker.rebuildFromFormation();
    expect(tracker.getEligibleInColumn(0)).toBe(col0Row2);

    slots[1].inFormation = false;
    tracker.onEnemyDetached();
    expect(tracker.getEligibleInColumn(0)).toBe(col0Row1);
    expect(tracker.isEligible(col0Row2)).toBe(false);
  });

  it('3) eligibility updates immediately on death and return', () => {
    const col0Row1 = createEnemy('c0r1');
    const col0Row2 = createEnemy('c0r2');
    const slots = [
      {
        enemy: col0Row1,
        row: 1,
        column: 0,
        alive: true,
        inFormation: true,
      },
      {
        enemy: col0Row2,
        row: 2,
        column: 0,
        alive: true,
        inFormation: true,
      },
    ];
    const tracker = new ShooterEligibility<Enemy>({
      getSlots: () => slots,
    });
    tracker.rebuildFromFormation();
    expect(tracker.getEligibleInColumn(0)).toBe(col0Row2);

    slots[1].alive = false;
    tracker.onEnemyDied();
    expect(tracker.getEligibleInColumn(0)).toBe(col0Row1);

    slots[1].alive = true;
    slots[1].inFormation = true;
    tracker.onEnemyReattached();
    expect(tracker.getEligibleInColumn(0)).toBe(col0Row2);
  });

  it('returns null for empty columns', () => {
    const col0Row0 = createEnemy('c0r0');
    const slots = [
      {
        enemy: col0Row0,
        row: 0,
        column: 0,
        alive: true,
        inFormation: true,
      },
    ];
    const tracker = new ShooterEligibility<Enemy>({
      getSlots: () => slots,
    });

    tracker.rebuildFromFormation();
    expect(tracker.getEligibleInColumn(1)).toBeNull();

    slots[0].alive = false;
    tracker.onEnemyDied();
    expect(tracker.getEligibleInColumn(0)).toBeNull();
  });
});
