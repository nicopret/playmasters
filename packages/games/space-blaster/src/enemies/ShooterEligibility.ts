export type ShooterEligibilitySlot<TEnemy> = {
  enemy: TEnemy;
  row: number;
  column: number;
  alive: boolean;
  inFormation: boolean;
};

export const computeEligibleShootersByColumn = <TEnemy>(
  slots: ShooterEligibilitySlot<TEnemy>[],
): Map<number, TEnemy> => {
  const bestByColumn = new Map<number, ShooterEligibilitySlot<TEnemy>>();
  for (const slot of slots) {
    if (!slot.alive || !slot.inFormation) continue;
    const currentBest = bestByColumn.get(slot.column);
    // "Lowest" means greatest row index (closer to player in the formation grid).
    if (!currentBest || slot.row > currentBest.row) {
      bestByColumn.set(slot.column, slot);
    }
  }

  const eligibleByColumn = new Map<number, TEnemy>();
  for (const [column, slot] of bestByColumn.entries()) {
    eligibleByColumn.set(column, slot.enemy);
  }
  return eligibleByColumn;
};

type ShooterEligibilityOptions<TEnemy> = {
  getSlots: () => ShooterEligibilitySlot<TEnemy>[];
};

export class ShooterEligibility<TEnemy> {
  private readonly getSlots: ShooterEligibilityOptions<TEnemy>['getSlots'];
  private readonly eligibleByColumn = new Map<number, TEnemy>();
  private readonly eligibleSet = new Set<TEnemy>();

  constructor(options: ShooterEligibilityOptions<TEnemy>) {
    this.getSlots = options.getSlots;
  }

  rebuildFromFormation(): void {
    this.recompute();
  }

  onEnemyDied(): void {
    this.recompute();
  }

  onEnemyDetached(): void {
    this.recompute();
  }

  onEnemyReattached(): void {
    this.recompute();
  }

  clear(): void {
    this.eligibleByColumn.clear();
    this.eligibleSet.clear();
  }

  isEligible(enemy: TEnemy): boolean {
    return this.eligibleSet.has(enemy);
  }

  getEligibleInColumn(column: number): TEnemy | null {
    return this.eligibleByColumn.get(column) ?? null;
  }

  getAllEligible(): Set<TEnemy> {
    return new Set(this.eligibleSet);
  }

  private recompute(): void {
    this.eligibleByColumn.clear();
    this.eligibleSet.clear();

    const eligibleByColumn = computeEligibleShootersByColumn(this.getSlots());
    for (const [column, enemy] of eligibleByColumn.entries()) {
      this.eligibleByColumn.set(column, enemy);
      this.eligibleSet.add(enemy);
    }
  }
}
