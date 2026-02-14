import { ShooterEligibility } from './ShooterEligibility';

type Enemy = { id: string };

const createEnemy = (id: string): Enemy => ({ id });

describe('ShooterEligibility', () => {
  it('selects the lowest alive in-formation shooter for each column', () => {
    const col0Row0 = createEnemy('c0r0');
    const col0Row1 = createEnemy('c0r1');
    const col0Row2 = createEnemy('c0r2');
    const col1Row0 = createEnemy('c1r0');
    const col1Row1 = createEnemy('c1r1');
    const slots = [
      {
        enemy: col0Row0,
        row: 0,
        column: 0,
        alive: true,
        inFormation: true,
      },
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
      {
        enemy: col1Row0,
        row: 0,
        column: 1,
        alive: true,
        inFormation: true,
      },
      {
        enemy: col1Row1,
        row: 1,
        column: 1,
        alive: true,
        inFormation: true,
      },
    ];
    const tracker = new ShooterEligibility<Enemy>({
      getSlots: () => slots,
    });

    tracker.rebuildFromFormation();

    expect(tracker.getEligibleInColumn(0)).toBe(col0Row2);
    expect(tracker.getEligibleInColumn(1)).toBe(col1Row1);
    expect(tracker.getAllEligible()).toEqual(new Set([col0Row2, col1Row1]));
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

  it('excludes divers while detached and restores on reattach', () => {
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
