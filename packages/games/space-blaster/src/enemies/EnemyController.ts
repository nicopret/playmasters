import { EnemyLocalState } from './EnemyLocalState';
import {
  computeDiveStep,
  computeReturnStep,
  computeSineDiveStep,
  computeTrackedDiveStep,
  type DivePattern,
  type Point,
} from './enemy-motion';

type EnemyActor = {
  active: boolean;
  x: number;
  y: number;
  setPosition: (x: number, y: number) => void;
};

type EnemyControllerOptions = {
  enemy: EnemyActor;
  getReservedSlotPose: () => Point | undefined;
  getPlayerPose?: () => Point | undefined;
  onLocalStateChanged?: (state: EnemyLocalState) => void;
  diveSpeedPxPerSecond: number;
  returnSpeedPxPerSecond: number;
  divePattern?: DivePattern;
  sineAmplitudePx?: number;
  sineFrequencyHz?: number;
  turnRateDegPerSecond?: number;
  maxDiveDurationMs: number;
  returnTriggerY?: number;
  arrivalThresholdPx: number;
};

export class EnemyController {
  private readonly enemy: EnemyActor;
  private readonly getReservedSlotPose: EnemyControllerOptions['getReservedSlotPose'];
  private readonly getPlayerPose?: EnemyControllerOptions['getPlayerPose'];
  private readonly onLocalStateChanged?: EnemyControllerOptions['onLocalStateChanged'];
  private readonly diveSpeedPxPerSecond: number;
  private readonly returnSpeedPxPerSecond: number;
  private readonly divePattern: DivePattern;
  private readonly sineAmplitudePx: number;
  private readonly sineFrequencyHz: number;
  private readonly turnRateDegPerSecond: number;
  private readonly maxDiveDurationMs: number;
  private readonly returnTriggerY?: number;
  private readonly arrivalThresholdPx: number;
  private localState = EnemyLocalState.FORMATION;
  private diveElapsedMs = 0;
  private diveBaseX = 0;
  private trackAngleRad = Math.PI / 2;

  constructor(options: EnemyControllerOptions) {
    this.enemy = options.enemy;
    this.getReservedSlotPose = options.getReservedSlotPose;
    this.getPlayerPose = options.getPlayerPose;
    this.onLocalStateChanged = options.onLocalStateChanged;
    this.diveSpeedPxPerSecond = options.diveSpeedPxPerSecond;
    this.returnSpeedPxPerSecond = options.returnSpeedPxPerSecond;
    this.divePattern = options.divePattern ?? 'straight';
    this.sineAmplitudePx = options.sineAmplitudePx ?? 0;
    this.sineFrequencyHz = options.sineFrequencyHz ?? 0;
    this.turnRateDegPerSecond = options.turnRateDegPerSecond ?? 0;
    this.maxDiveDurationMs = options.maxDiveDurationMs;
    this.returnTriggerY = options.returnTriggerY;
    this.arrivalThresholdPx = options.arrivalThresholdPx;
  }

  get state(): EnemyLocalState {
    return this.localState;
  }

  startDive(): void {
    if (this.localState !== EnemyLocalState.FORMATION) return;
    this.localState = EnemyLocalState.DIVING;
    this.diveElapsedMs = 0;
    this.diveBaseX = this.enemy.x;
    this.trackAngleRad = Math.PI / 2;
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
      const next = this.computeDivePatternStep(simDtMs);
      this.enemy.setPosition(next.x, next.y);
      this.diveElapsedMs += simDtMs;
      const hitDiveDuration =
        this.maxDiveDurationMs > 0 &&
        this.diveElapsedMs >= this.maxDiveDurationMs;
      const hitReturnY =
        typeof this.returnTriggerY === 'number' &&
        this.enemy.y >= this.returnTriggerY;
      if (hitDiveDuration || hitReturnY) {
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
      this.setDead();
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

  private computeDivePatternStep(simDtMs: number): Point {
    if (this.divePattern === 'sine') {
      return computeSineDiveStep({
        baseX: this.diveBaseX,
        position: { x: this.enemy.x, y: this.enemy.y },
        speedPxPerSecond: this.diveSpeedPxPerSecond,
        dtMs: simDtMs,
        elapsedMs: this.diveElapsedMs,
        amplitudePx: this.sineAmplitudePx,
        frequencyHz: this.sineFrequencyHz,
      });
    }

    if (this.divePattern === 'track') {
      const player = this.getPlayerPose?.();
      if (player) {
        const tracked = computeTrackedDiveStep({
          position: { x: this.enemy.x, y: this.enemy.y },
          speedPxPerSecond: this.diveSpeedPxPerSecond,
          dtMs: simDtMs,
          currentAngleRad: this.trackAngleRad,
          target: player,
          turnRateDegPerSecond: this.turnRateDegPerSecond,
        });
        this.trackAngleRad = tracked.angleRad;
        return tracked.position;
      }
    }

    return computeDiveStep({
      position: { x: this.enemy.x, y: this.enemy.y },
      speedPxPerSecond: this.diveSpeedPxPerSecond,
      dtMs: simDtMs,
    });
  }
}
