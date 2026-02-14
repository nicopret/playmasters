import { EnemyLocalState } from './EnemyLocalState';

type DiveSchedulerController = {
  state: EnemyLocalState;
  startDive: () => void;
};

export type DiveSchedulerCandidate<TEnemy = unknown> = {
  enemy: TEnemy;
  active: boolean;
  canDive: boolean;
  controller: DiveSchedulerController;
};

export type DiveSchedulerConfig = {
  attackTickMs: number;
  diveChancePerTick: number;
  maxConcurrentDivers: number;
};

type DiveSchedulerOptions<TEnemy = unknown> = {
  config: DiveSchedulerConfig;
  getCandidates: () => DiveSchedulerCandidate<TEnemy>[];
  randomFloat?: () => number;
};

export class DiveScheduler<TEnemy = unknown> {
  private readonly config: DiveSchedulerConfig;
  private readonly getCandidates: DiveSchedulerOptions<TEnemy>['getCandidates'];
  private readonly randomFloat: () => number;
  private attackTickAccumulatorMs = 0;

  constructor(options: DiveSchedulerOptions<TEnemy>) {
    this.config = options.config;
    this.getCandidates = options.getCandidates;
    this.randomFloat = options.randomFloat ?? Math.random;
  }

  update(simDtMs: number): void {
    if (simDtMs <= 0) {
      return;
    }

    const attackTickMs = this.config.attackTickMs;
    if (attackTickMs <= 0) {
      return;
    }

    this.attackTickAccumulatorMs += simDtMs;
    while (this.attackTickAccumulatorMs >= attackTickMs) {
      this.attackTickAccumulatorMs -= attackTickMs;
      this.processAttackTick();
    }
  }

  private processAttackTick(): void {
    const maxConcurrentDivers = Math.max(0, this.config.maxConcurrentDivers);
    if (maxConcurrentDivers <= 0) {
      return;
    }

    const activeCandidates = this.getCandidates().filter((candidate) => {
      return candidate.active;
    });
    const concurrentDivers = activeCandidates.filter(
      (candidate) => candidate.controller.state === EnemyLocalState.DIVING,
    ).length;
    if (concurrentDivers >= maxConcurrentDivers) {
      return;
    }

    const diveChancePerTick = Math.max(
      0,
      Math.min(1, this.config.diveChancePerTick),
    );
    if (diveChancePerTick <= 0) {
      return;
    }
    if (this.randomFloat() >= diveChancePerTick) {
      return;
    }

    const eligible = activeCandidates.filter((candidate) => {
      return (
        candidate.canDive &&
        candidate.controller.state === EnemyLocalState.FORMATION
      );
    });
    if (eligible.length === 0) {
      return;
    }

    const clamped = Math.max(0, Math.min(0.999999999, this.randomFloat()));
    const index = Math.floor(clamped * eligible.length);
    eligible[index]?.controller.startDive();
  }
}
