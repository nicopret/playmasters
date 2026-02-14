export type ShooterEligibilitySlot<TEnemy> = {
  enemy: TEnemy;
  row: number;
  column: number;
  alive: boolean;
  inFormation: boolean;
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

    const bestByColumn = new Map<number, ShooterEligibilitySlot<TEnemy>>();
    for (const slot of this.getSlots()) {
      if (!slot.alive || !slot.inFormation) continue;
      const currentBest = bestByColumn.get(slot.column);
      if (!currentBest || slot.row > currentBest.row) {
        bestByColumn.set(slot.column, slot);
      }
    }

    for (const [column, slot] of bestByColumn.entries()) {
      this.eligibleByColumn.set(column, slot.enemy);
      this.eligibleSet.add(slot.enemy);
    }
  }
}
