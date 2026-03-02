import type {
  FormationLayoutEntryV1,
  ResolvedLevelWaveV1,
} from '@playmasters/types';
import { EnemyLocalState } from '../enemies/EnemyLocalState';
import {
  ShooterEligibility,
  type ShooterEligibilitySlot,
} from '../enemies/ShooterEligibility';
import type { RunContext } from '../runtime';
import {
  computeExtentsFromOccupancy,
  computeRampTargetSpeed,
  computeSlotLocalOffsets,
  computeStallAggressionTargetSpeed,
  easeToward,
  stepFormation,
  type FleetEnrageConfig,
  type FleetRampConfig,
  type FormationState,
  type SlotLocalOffset,
  type StallAggressionConfig,
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
  enemyId: string;
  enemy: FormationEnemy;
  localState: EnemyLocalState;
};

type FormationSystemOptions = {
  ctx: RunContext;
  playBounds: () => { minX: number; maxX: number; minY: number };
  enemyManager: FormationEnemyManager;
  onForceWaveComplete?: (reason: 'ENRAGE_TIMEOUT') => void;
  levelIndex?: number;
};

const DEFAULT_FLEET_RAMP_CONFIG: FleetRampConfig = {
  maxMultiplier: 2,
  exponent: 1.25,
  minAliveForRamp: 1,
};

const DEFAULT_ENRAGE_CONFIG: FleetEnrageConfig = {
  threshold: 0,
  speedMultiplier: 2.8,
  timeoutMs: 7000,
  autoCompleteOnTimeout: true,
};

const DEFAULT_STALL_AGGRESSION_CONFIG: StallAggressionConfig = {
  threshold: 0,
  speedMultiplier: 1,
};

const DEFAULT_SPEED_SMOOTHING_PER_SECOND = 7;
const FORMATION_SPAWN_TOP_PADDING = 36;
const PREVIEW_GRID_WIDTH = 700;
const PREVIEW_GRID_HEIGHT = 320;

export class FormationSystem {
  private readonly ctx: RunContext;
  private readonly getPlayBounds: FormationSystemOptions['playBounds'];
  private readonly enemyManager: FormationEnemyManager;
  private readonly onForceWaveComplete?: FormationSystemOptions['onForceWaveComplete'];
  private levelIndex: number;
  private slots: FormationSlotAssignment[] = [];
  private state: FormationState = { originX: 0, originY: 0, direction: 1 };
  private baseFleetSpeed = 0;
  private currentFleetSpeed = 0;
  private speedSmoothingPerSecond = DEFAULT_SPEED_SMOOTHING_PER_SECOND;
  private descendStep = 0;
  private initialEnemyCount = 0;
  private rampConfig = DEFAULT_FLEET_RAMP_CONFIG;
  private enrageConfig = DEFAULT_ENRAGE_CONFIG;
  private stallAggressionConfig = DEFAULT_STALL_AGGRESSION_CONFIG;
  private stallAggressionActive = false;
  private enraged = false;
  private enrageElapsedMs = 0;
  private forceWaveCompleteRequested = false;
  private readonly shooterEligibility = new ShooterEligibility<FormationEnemy>({
    getSlots: () => this.getShooterEligibilitySlots(),
  });

  constructor(options: FormationSystemOptions) {
    this.ctx = options.ctx;
    this.getPlayBounds = options.playBounds;
    this.enemyManager = options.enemyManager;
    this.onForceWaveComplete = options.onForceWaveComplete;
    this.levelIndex = options.levelIndex ?? 0;
  }

  setLevelIndex(levelIndex: number): void {
    this.levelIndex = Math.max(0, levelIndex);
  }

  clear(): void {
    this.enemyManager.clearEnemies();
    this.slots = [];
    this.resetWaveMotionState();
    this.shooterEligibility.clear();
  }

  spawnFormation(wave: ResolvedLevelWaveV1): void {
    const level = this.ctx.resolvedConfig.levelConfigs[this.levelIndex];
    if (!level) return;

    const layout = this.resolveLayout(level.layoutId);
    if (!layout) return;

    this.enemyManager.clearEnemies();
    this.slots = [];
    this.baseFleetSpeed =
      typeof level.speed === 'number' ? level.speed : layout.spacing.x;
    this.currentFleetSpeed = this.baseFleetSpeed;
    this.speedSmoothingPerSecond =
      level.fleetSpeedRamp?.smoothingPerSecond ??
      DEFAULT_SPEED_SMOOTHING_PER_SECOND;
    this.rampConfig = {
      maxMultiplier:
        level.fleetSpeedRamp?.maxMultiplier ??
        DEFAULT_FLEET_RAMP_CONFIG.maxMultiplier,
      exponent:
        level.fleetSpeedRamp?.exponent ?? DEFAULT_FLEET_RAMP_CONFIG.exponent,
      minAliveForRamp:
        level.fleetSpeedRamp?.minAliveForRamp ??
        DEFAULT_FLEET_RAMP_CONFIG.minAliveForRamp,
    };
    this.enrageConfig = {
      threshold:
        level.lastEnemiesEnrage?.threshold ?? DEFAULT_ENRAGE_CONFIG.threshold,
      speedMultiplier:
        level.lastEnemiesEnrage?.speedMultiplier ??
        DEFAULT_ENRAGE_CONFIG.speedMultiplier,
      timeoutMs:
        level.lastEnemiesEnrage?.timeoutMs ?? DEFAULT_ENRAGE_CONFIG.timeoutMs,
      autoCompleteOnTimeout:
        level.lastEnemiesEnrage?.autoCompleteOnTimeout ??
        DEFAULT_ENRAGE_CONFIG.autoCompleteOnTimeout,
    };
    this.stallAggressionConfig = {
      threshold:
        level.stallAggression?.threshold ??
        DEFAULT_STALL_AGGRESSION_CONFIG.threshold,
      speedMultiplier:
        level.stallAggression?.speedMultiplier ??
        DEFAULT_STALL_AGGRESSION_CONFIG.speedMultiplier,
    };
    this.descendStep =
      typeof (level as { descendStep?: number }).descendStep === 'number'
        ? Math.max(0, (level as { descendStep?: number }).descendStep ?? 0)
        : layout.spacing.y;

    const formationGrid = (
      level as {
        formationGrid?: {
          columns?: number;
          rows?: number;
          placements?: Array<{
            id?: string;
            enemyId?: string;
            col?: number;
            row?: number;
            width?: number;
            height?: number;
          }>;
        };
      }
    ).formationGrid;
    const normalizedGridPlacements =
      formationGrid?.placements
        ?.map((placement, index) => {
          if (!placement || typeof placement !== 'object') return null;
          const enemyId = `${placement.enemyId ?? ''}`.trim();
          if (!enemyId) return null;
          const col = Number(placement.col);
          const row = Number(placement.row);
          if (!Number.isFinite(col) || !Number.isFinite(row)) return null;
          const width =
            Number.isFinite(Number(placement.width)) &&
            Number(placement.width) >= 2
              ? 2
              : 1;
          const height =
            Number.isFinite(Number(placement.height)) &&
            Number(placement.height) >= 2
              ? 2
              : 1;
          return {
            id:
              typeof placement.id === 'string' && placement.id.trim()
                ? placement.id.trim()
                : `placement-${index}`,
            enemyId,
            col: Math.max(0, Math.floor(col)),
            row: Math.max(0, Math.floor(row)),
            width,
            height,
          };
        })
        .filter(
          (
            placement,
          ): placement is {
            id: string;
            enemyId: string;
            col: number;
            row: number;
            width: number;
            height: number;
          } => !!placement,
        ) ?? [];
    const useGridPlacementMode = normalizedGridPlacements.length > 0;
    const requestedCount =
      typeof wave.count === 'number' && wave.count > 0 ? wave.count : 1;
    this.enraged = false;
    this.stallAggressionActive = false;
    this.enrageElapsedMs = 0;
    this.forceWaveCompleteRequested = false;
    const offsets: Array<SlotLocalOffset & { enemyId: string }> =
      useGridPlacementMode
        ? normalizedGridPlacements
            .slice()
            .sort((left, right) =>
              left.row === right.row
                ? left.col - right.col
                : left.row - right.row,
            )
            .map((placement) => {
              const gridColumns = Math.max(
                1,
                Math.floor(formationGrid?.columns ?? layout.columns),
              );
              const gridRows = Math.max(
                1,
                Math.floor(formationGrid?.rows ?? layout.rows),
              );
              // Keep runtime formation geometry aligned with the lightweight preview.
              const cellWidth = PREVIEW_GRID_WIDTH / gridColumns;
              const cellHeight = PREVIEW_GRID_HEIGHT / gridRows;
              const xCenterOffset = ((gridColumns - 1) * cellWidth) / 2;
              const yCenterOffset = ((gridRows - 1) * cellHeight) / 2;
              const localX =
                placement.col * cellWidth -
                xCenterOffset +
                ((placement.width - 1) * cellWidth) / 2 +
                (layout.offset?.x ?? 0);
              const localY =
                placement.row * cellHeight -
                yCenterOffset +
                ((placement.height - 1) * cellHeight) / 2 +
                (layout.offset?.y ?? 0);
              return {
                slotId: placement.id,
                row: placement.row,
                column: placement.col,
                localX,
                localY,
                enemyId: placement.enemyId,
              };
            })
        : computeSlotLocalOffsets(layout, requestedCount).map((offset) => ({
            ...offset,
            enemyId: wave.enemyId,
          }));
    this.initialEnemyCount = offsets.length;
    const bounds = this.getPlayBounds();
    const minLocalY =
      offsets.length > 0
        ? offsets.reduce(
            (minValue, slot) => Math.min(minValue, slot.localY),
            offsets[0].localY,
          )
        : 0;

    this.state = {
      originX: (bounds.minX + bounds.maxX) / 2,
      originY: bounds.minY + FORMATION_SPAWN_TOP_PADDING - minLocalY,
      direction: 1,
    };

    for (const slot of offsets) {
      const enemy = this.enemyManager.spawnEnemy(slot.enemyId, 0, 0);
      this.slots.push({
        ...slot,
        enemy,
        localState: EnemyLocalState.FORMATION,
      });
    }

    this.applyCurrentPose();
    this.shooterEligibility.rebuildFromFormation();
  }

  update(simDtMs: number): void {
    this.clearDeadReservations();
    const aliveEnemies = this.getAliveSlots().length;
    if (aliveEnemies === 0) return;

    this.updateEnrageState(simDtMs, aliveEnemies);
    this.updateSpeed(simDtMs, aliveEnemies);
    // Bounds/extents are based on alive in-formation slots only; detached divers do not widen bounds.
    const extents = computeExtentsFromOccupancy(
      this.slots.map((slot) => ({
        localX: slot.localX,
        width: slot.enemy.width,
        alive: slot.enemy.active,
        inFormation: slot.localState === EnemyLocalState.FORMATION,
      })),
    );
    if (!extents) return;

    const bounds = this.getPlayBounds();
    this.state = stepFormation({
      state: this.state,
      dtMs: simDtMs,
      speedPxPerSecond: this.currentFleetSpeed,
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

  getReservedSlotId(enemy: FormationEnemy): string | undefined {
    const slot = this.slots.find((entry) => entry.enemy === enemy);
    return slot?.slotId;
  }

  getReservedSlotWorldPose(
    enemy: FormationEnemy,
  ): { x: number; y: number } | undefined {
    const slot = this.slots.find((entry) => entry.enemy === enemy);
    if (!slot) return undefined;
    return {
      x: this.state.originX + slot.localX,
      y: this.state.originY + slot.localY,
    };
  }

  getManagedEnemies(): FormationEnemy[] {
    return this.slots.map((slot) => slot.enemy);
  }

  getEnemyLocalState(enemy: FormationEnemy): EnemyLocalState | undefined {
    return this.slots.find((entry) => entry.enemy === enemy)?.localState;
  }

  setEnemyLocalState(enemy: FormationEnemy, localState: EnemyLocalState): void {
    const slot = this.slots.find((entry) => entry.enemy === enemy);
    if (!slot) return;
    const priorState = slot.localState;
    slot.localState = localState;
    if (priorState === localState) return;
    if (localState === EnemyLocalState.FORMATION) {
      this.shooterEligibility.onEnemyReattached();
      return;
    }
    this.shooterEligibility.onEnemyDetached();
  }

  onEnemyDeath(enemy: FormationEnemy): void {
    const slotIndex = this.slots.findIndex((entry) => entry.enemy === enemy);
    if (slotIndex < 0) return;
    this.slots.splice(slotIndex, 1);
    this.shooterEligibility.onEnemyDied();
  }

  isEligibleShooter(enemy: FormationEnemy): boolean {
    return this.shooterEligibility.isEligible(enemy);
  }

  getEligibleShooterInColumn(column: number): FormationEnemy | null {
    return this.shooterEligibility.getEligibleInColumn(column);
  }

  getEligibleShooters(): Set<FormationEnemy> {
    return this.shooterEligibility.getAllEligible();
  }

  pickEligibleShooter(
    randomFloat: () => number = Math.random,
  ): FormationEnemy | null {
    const eligible = Array.from(this.shooterEligibility.getAllEligible());
    if (eligible.length === 0) return null;
    const clamped = Math.max(0, Math.min(0.999999999, randomFloat()));
    const index = Math.floor(clamped * eligible.length);
    return eligible[index] ?? null;
  }

  getMotionDiagnostics(): {
    currentFleetSpeed: number;
    baseFleetSpeed: number;
    initialEnemyCount: number;
    stallAggressionActive: boolean;
    enraged: boolean;
    enrageElapsedMs: number;
    forceWaveCompleteRequested: boolean;
  } {
    return {
      currentFleetSpeed: this.currentFleetSpeed,
      baseFleetSpeed: this.baseFleetSpeed,
      initialEnemyCount: this.initialEnemyCount,
      stallAggressionActive: this.stallAggressionActive,
      enraged: this.enraged,
      enrageElapsedMs: this.enrageElapsedMs,
      forceWaveCompleteRequested: this.forceWaveCompleteRequested,
    };
  }

  private resolveLayout(layoutId: string): FormationLayoutEntryV1 | undefined {
    return this.ctx.resolvedConfig.formationLayouts.entries.find(
      (entry) => entry.layoutId === layoutId,
    );
  }

  private getOccupiedSlots(): FormationSlotAssignment[] {
    const active = new Set(this.enemyManager.getActiveEnemies());
    return this.slots.filter(
      (slot) =>
        slot.enemy.active &&
        active.has(slot.enemy) &&
        slot.localState === EnemyLocalState.FORMATION,
    );
  }

  private getAliveSlots(): FormationSlotAssignment[] {
    const active = new Set(this.enemyManager.getActiveEnemies());
    return this.slots.filter(
      (slot) => slot.enemy.active && active.has(slot.enemy),
    );
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

  private resetWaveMotionState(): void {
    this.initialEnemyCount = 0;
    this.currentFleetSpeed = 0;
    this.baseFleetSpeed = 0;
    this.stallAggressionActive = false;
    this.enraged = false;
    this.enrageElapsedMs = 0;
    this.forceWaveCompleteRequested = false;
  }

  private clearDeadReservations(): void {
    const active = new Set(this.enemyManager.getActiveEnemies());
    const priorLength = this.slots.length;
    this.slots = this.slots.filter(
      (slot) =>
        slot.localState !== EnemyLocalState.DEAD &&
        slot.enemy.active &&
        active.has(slot.enemy),
    );
    if (this.slots.length !== priorLength) {
      this.shooterEligibility.rebuildFromFormation();
    }
  }

  private updateSpeed(simDtMs: number, aliveEnemies: number): void {
    let targetSpeed = computeRampTargetSpeed({
      baseSpeed: this.baseFleetSpeed,
      initialEnemies: this.initialEnemyCount,
      aliveEnemies,
      ramp: this.rampConfig,
    });
    const stallAggressionTarget = computeStallAggressionTargetSpeed({
      baseSpeed: this.baseFleetSpeed,
      aliveEnemies,
      config: this.stallAggressionConfig,
    });
    if (stallAggressionTarget !== null) {
      this.stallAggressionActive = true;
      targetSpeed = Math.max(targetSpeed, stallAggressionTarget);
    } else {
      this.stallAggressionActive = false;
    }
    if (this.enraged) {
      targetSpeed = Math.max(
        targetSpeed,
        this.baseFleetSpeed * this.enrageConfig.speedMultiplier,
      );
    }
    if (this.stallAggressionActive) {
      // Stall aggression is intentionally sharp: jump to the configured speed immediately.
      this.currentFleetSpeed = targetSpeed;
      return;
    }
    this.currentFleetSpeed = easeToward({
      current: this.currentFleetSpeed,
      target: targetSpeed,
      dtMs: simDtMs,
      smoothingPerSecond: this.speedSmoothingPerSecond,
    });
  }

  private updateEnrageState(simDtMs: number, aliveEnemies: number): void {
    if (
      !this.enraged &&
      this.enrageConfig.threshold > 0 &&
      aliveEnemies > 0 &&
      aliveEnemies <= this.enrageConfig.threshold
    ) {
      this.enraged = true;
      this.enrageElapsedMs = 0;
    }

    if (!this.enraged || aliveEnemies <= 0) {
      return;
    }

    this.enrageElapsedMs += simDtMs;
    if (
      this.enrageElapsedMs >= this.enrageConfig.timeoutMs &&
      this.enrageConfig.autoCompleteOnTimeout &&
      !this.forceWaveCompleteRequested
    ) {
      this.forceWaveCompleteRequested = true;
      this.onForceWaveComplete?.('ENRAGE_TIMEOUT');
    }
  }

  private getShooterEligibilitySlots(): ShooterEligibilitySlot<FormationEnemy>[] {
    const active = new Set(this.enemyManager.getActiveEnemies());
    return this.slots.map((slot) => ({
      enemy: slot.enemy,
      row: slot.row,
      column: slot.column,
      alive: slot.enemy.active && active.has(slot.enemy),
      inFormation: slot.localState === EnemyLocalState.FORMATION,
    }));
  }
}
