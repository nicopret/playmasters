import type {
  FormationLayoutEntryV1,
  ResolvedLevelWaveV1,
} from '@playmasters/types';
import type { RunContext } from '../runtime';
import {
  computeExtentsFromOffsets,
  computeSlotLocalOffsets,
  stepFormation,
  type FormationState,
  type SlotLocalOffset,
} from './formation-motion';

export type FormationEnemy = {
  active: boolean;
  x: number;
  y: number;
  width: number;
  setPosition: (x: number, y: number) => void;
};

export type FormationEnemyManager = {
  spawnEnemy: (enemyId: string, x: number, y: number) => FormationEnemy;
  getActiveEnemies: () => FormationEnemy[];
  clearEnemies: () => void;
};

type FormationSlotAssignment = SlotLocalOffset & {
  enemy: FormationEnemy;
};

type FormationSystemOptions = {
  ctx: RunContext;
  playBounds: () => { minX: number; maxX: number; minY: number };
  enemyManager: FormationEnemyManager;
  levelIndex?: number;
};

export class FormationSystem {
  private readonly ctx: RunContext;
  private readonly getPlayBounds: FormationSystemOptions['playBounds'];
  private readonly enemyManager: FormationEnemyManager;
  private readonly levelIndex: number;
  private slots: FormationSlotAssignment[] = [];
  private state: FormationState = { originX: 0, originY: 0, direction: 1 };
  private fleetSpeed = 0;
  private descendStep = 0;

  constructor(options: FormationSystemOptions) {
    this.ctx = options.ctx;
    this.getPlayBounds = options.playBounds;
    this.enemyManager = options.enemyManager;
    this.levelIndex = options.levelIndex ?? 0;
  }

  clear(): void {
    this.enemyManager.clearEnemies();
    this.slots = [];
  }

  spawnFormation(wave: ResolvedLevelWaveV1): void {
    const level = this.ctx.resolvedConfig.levelConfigs[this.levelIndex];
    if (!level) return;

    const layout = this.resolveLayout(level.layoutId);
    if (!layout) return;

    this.enemyManager.clearEnemies();
    this.slots = [];
    this.fleetSpeed =
      typeof level.speed === 'number' ? level.speed : layout.spacing.x;
    // The current runtime schema has no explicit descendStep, so use layout spacing.
    this.descendStep = layout.spacing.y;

    const requestedCount =
      typeof wave.count === 'number' && wave.count > 0 ? wave.count : 1;
    const offsets = computeSlotLocalOffsets(layout, requestedCount);
    const bounds = this.getPlayBounds();

    this.state = {
      originX: (bounds.minX + bounds.maxX) / 2,
      originY: bounds.minY + layout.spacing.y,
      direction: 1,
    };

    for (const slot of offsets) {
      const enemy = this.enemyManager.spawnEnemy(wave.enemyId, 0, 0);
      this.slots.push({ ...slot, enemy });
    }

    this.applyCurrentPose();
  }

  update(simDtMs: number): void {
    // Bounds/extents are based on occupied slots so the formation narrows as enemies are removed.
    const occupied = this.getOccupiedSlots();
    if (occupied.length === 0) return;

    const bounds = this.getPlayBounds();
    const halfEnemyWidth = this.getHalfEnemyWidth(occupied);
    const extents = computeExtentsFromOffsets(occupied, halfEnemyWidth);
    this.state = stepFormation({
      state: this.state,
      dtMs: simDtMs,
      speedPxPerSecond: this.fleetSpeed,
      descendStep: this.descendStep,
      minBoundX: bounds.minX,
      maxBoundX: bounds.maxX,
      extents,
    }).state;

    this.applyCurrentPose();
  }

  getEnemyWorldPose(slotId: string): { x: number; y: number } | undefined {
    const slot = this.slots.find((entry) => entry.slotId === slotId);
    if (!slot) return undefined;
    return {
      x: this.state.originX + slot.localX,
      y: this.state.originY + slot.localY,
    };
  }

  private resolveLayout(layoutId: string): FormationLayoutEntryV1 | undefined {
    return this.ctx.resolvedConfig.formationLayouts.entries.find(
      (entry) => entry.layoutId === layoutId,
    );
  }

  private getOccupiedSlots(): FormationSlotAssignment[] {
    const active = new Set(this.enemyManager.getActiveEnemies());
    return this.slots.filter((slot) => slot.enemy.active && active.has(slot.enemy));
  }

  private getHalfEnemyWidth(occupied: FormationSlotAssignment[]): number {
    let halfEnemyWidth = 0;
    for (const slot of occupied) {
      const width = slot.enemy.width;
      if (width / 2 > halfEnemyWidth) {
        halfEnemyWidth = width / 2;
      }
    }
    return halfEnemyWidth;
  }

  private applyCurrentPose(): void {
    const occupied = this.getOccupiedSlots();
    for (const slot of occupied) {
      slot.enemy.setPosition(
        this.state.originX + slot.localX,
        this.state.originY + slot.localY,
      );
    }
  }
}
