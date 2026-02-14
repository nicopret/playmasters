import { EnemyLocalState } from './EnemyLocalState';
import { computeDiveStep, computeReturnStep, type Point } from './enemy-motion';

type EnemyActor = {
  active: boolean;
  x: number;
  y: number;
  setPosition: (x: number, y: number) => void;
};

type EnemyControllerOptions = {
  enemy: EnemyActor;
  getReservedSlotPose: () => Point | undefined;
  onLocalStateChanged?: (state: EnemyLocalState) => void;
  diveSpeedPxPerSecond: number;
  returnSpeedPxPerSecond: number;
  diveDurationMs: number;
  arrivalThresholdPx: number;
};

export class EnemyController {
  private readonly enemy: EnemyActor;
  private readonly getReservedSlotPose: EnemyControllerOptions['getReservedSlotPose'];
  private readonly onLocalStateChanged?: EnemyControllerOptions['onLocalStateChanged'];
  private readonly diveSpeedPxPerSecond: number;
  private readonly returnSpeedPxPerSecond: number;
  private readonly diveDurationMs: number;
  private readonly arrivalThresholdPx: number;
  private localState = EnemyLocalState.FORMATION;
  private diveElapsedMs = 0;

  constructor(options: EnemyControllerOptions) {
    this.enemy = options.enemy;
    this.getReservedSlotPose = options.getReservedSlotPose;
    this.onLocalStateChanged = options.onLocalStateChanged;
    this.diveSpeedPxPerSecond = options.diveSpeedPxPerSecond;
    this.returnSpeedPxPerSecond = options.returnSpeedPxPerSecond;
    this.diveDurationMs = options.diveDurationMs;
    this.arrivalThresholdPx = options.arrivalThresholdPx;
  }

  get state(): EnemyLocalState {
    return this.localState;
  }

  startDive(): void {
    if (this.localState !== EnemyLocalState.FORMATION) return;
    this.localState = EnemyLocalState.DIVING;
    this.diveElapsedMs = 0;
    this.onLocalStateChanged?.(EnemyLocalState.DIVING);
  }

  setDead(): void {
    if (this.localState === EnemyLocalState.DEAD) return;
    this.localState = EnemyLocalState.DEAD;
    this.onLocalStateChanged?.(EnemyLocalState.DEAD);
  }

  update(simDtMs: number): void {
    if (!this.enemy.active || this.localState === EnemyLocalState.DEAD) {
      this.setDead();
      return;
    }

    if (this.localState === EnemyLocalState.FORMATION) {
      return;
    }

    if (this.localState === EnemyLocalState.DIVING) {
      const next = computeDiveStep({
        position: { x: this.enemy.x, y: this.enemy.y },
        speedPxPerSecond: this.diveSpeedPxPerSecond,
        dtMs: simDtMs,
      });
      this.enemy.setPosition(next.x, next.y);
      this.diveElapsedMs += simDtMs;
      if (this.diveElapsedMs >= this.diveDurationMs) {
        this.localState = EnemyLocalState.RETURNING;
        this.onLocalStateChanged?.(EnemyLocalState.RETURNING);
      }
      return;
    }

    if (this.localState !== EnemyLocalState.RETURNING) {
      return;
    }
    const target = this.getReservedSlotPose();
    if (!target) {
      return;
    }

    const result = computeReturnStep({
      position: { x: this.enemy.x, y: this.enemy.y },
      target,
      speedPxPerSecond: this.returnSpeedPxPerSecond,
      dtMs: simDtMs,
      arrivalThresholdPx: this.arrivalThresholdPx,
    });
    this.enemy.setPosition(result.position.x, result.position.y);
    if (result.arrived) {
      this.localState = EnemyLocalState.FORMATION;
      this.onLocalStateChanged?.(EnemyLocalState.FORMATION);
    }
  }
}
