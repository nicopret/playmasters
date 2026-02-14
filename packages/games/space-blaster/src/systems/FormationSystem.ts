import type {
  FormationLayoutEntryV1,
  ResolvedLevelWaveV1,
} from '@playmasters/types';
import type { RunContext } from '../runtime';
import {
  computeExtentsFromOffsets,
  computeRampTargetSpeed,
  computeSlotLocalOffsets,
  easeToward,
  stepFormation,
  type FleetEnrageConfig,
  type FleetRampConfig,
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

const DEFAULT_SPEED_SMOOTHING_PER_SECOND = 7;

export class FormationSystem {
  private readonly ctx: RunContext;
  private readonly getPlayBounds: FormationSystemOptions['playBounds'];
  private readonly enemyManager: FormationEnemyManager;
  private readonly onForceWaveComplete?: FormationSystemOptions['onForceWaveComplete'];
  private readonly levelIndex: number;
  private slots: FormationSlotAssignment[] = [];
  private state: FormationState = { originX: 0, originY: 0, direction: 1 };
  private baseFleetSpeed = 0;
  private currentFleetSpeed = 0;
  private speedSmoothingPerSecond = DEFAULT_SPEED_SMOOTHING_PER_SECOND;
  private descendStep = 0;
  private initialEnemyCount = 0;
  private rampConfig = DEFAULT_FLEET_RAMP_CONFIG;
  private enrageConfig = DEFAULT_ENRAGE_CONFIG;
  private enraged = false;
  private enrageElapsedMs = 0;
  private forceWaveCompleteRequested = false;

  constructor(options: FormationSystemOptions) {
    this.ctx = options.ctx;
    this.getPlayBounds = options.playBounds;
    this.enemyManager = options.enemyManager;
    this.onForceWaveComplete = options.onForceWaveComplete;
    this.levelIndex = options.levelIndex ?? 0;
  }

  clear(): void {
    this.enemyManager.clearEnemies();
    this.slots = [];
    this.resetWaveMotionState();
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
      level.fleetSpeedRamp?.smoothingPerSecond ?? DEFAULT_SPEED_SMOOTHING_PER_SECOND;
    this.rampConfig = {
      maxMultiplier:
        level.fleetSpeedRamp?.maxMultiplier ?? DEFAULT_FLEET_RAMP_CONFIG.maxMultiplier,
      exponent: level.fleetSpeedRamp?.exponent ?? DEFAULT_FLEET_RAMP_CONFIG.exponent,
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
      timeoutMs: level.lastEnemiesEnrage?.timeoutMs ?? DEFAULT_ENRAGE_CONFIG.timeoutMs,
      autoCompleteOnTimeout:
        level.lastEnemiesEnrage?.autoCompleteOnTimeout ??
        DEFAULT_ENRAGE_CONFIG.autoCompleteOnTimeout,
    };
    // The current runtime schema has no explicit descendStep, so use layout spacing.
    this.descendStep = layout.spacing.y;

    const requestedCount =
      typeof wave.count === 'number' && wave.count > 0 ? wave.count : 1;
    this.enraged = false;
    this.enrageElapsedMs = 0;
    this.forceWaveCompleteRequested = false;
    const offsets = computeSlotLocalOffsets(layout, requestedCount);
    this.initialEnemyCount = offsets.length;
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
    const aliveEnemies = occupied.length;
    this.updateEnrageState(simDtMs, aliveEnemies);
    this.updateSpeed(simDtMs, aliveEnemies);

    const bounds = this.getPlayBounds();
    const halfEnemyWidth = this.getHalfEnemyWidth(occupied);
    const extents = computeExtentsFromOffsets(occupied, halfEnemyWidth);
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

  getMotionDiagnostics(): {
    currentFleetSpeed: number;
    baseFleetSpeed: number;
    initialEnemyCount: number;
    enraged: boolean;
    enrageElapsedMs: number;
    forceWaveCompleteRequested: boolean;
  } {
    return {
      currentFleetSpeed: this.currentFleetSpeed,
      baseFleetSpeed: this.baseFleetSpeed,
      initialEnemyCount: this.initialEnemyCount,
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

  private resetWaveMotionState(): void {
    this.initialEnemyCount = 0;
    this.currentFleetSpeed = 0;
    this.baseFleetSpeed = 0;
    this.enraged = false;
    this.enrageElapsedMs = 0;
    this.forceWaveCompleteRequested = false;
  }

  private updateSpeed(simDtMs: number, aliveEnemies: number): void {
    let targetSpeed = computeRampTargetSpeed({
      baseSpeed: this.baseFleetSpeed,
      initialEnemies: this.initialEnemyCount,
      aliveEnemies,
      ramp: this.rampConfig,
    });
    if (this.enraged) {
      targetSpeed = Math.max(
        targetSpeed,
        this.baseFleetSpeed * this.enrageConfig.speedMultiplier,
      );
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
}
