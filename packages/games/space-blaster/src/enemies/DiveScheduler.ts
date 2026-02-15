import { EnemyLocalState } from './EnemyLocalState';

type DiveSchedulerController = {
  state: EnemyLocalState;
  startDive: () => void;
};

export type DiveSchedulerCandidate<TEnemy = unknown> = {
  enemy: TEnemy;
  enemyId?: string;
  active: boolean;
  canDive: boolean;
  controller: DiveSchedulerController;
};

export type DiveSchedulerConfig = {
  attackTickMs: number;
  diveChancePerTick: number;
  maxConcurrentDivers: number;
  telegraphLeadMs?: number;
};

type DiveSchedulerOptions<TEnemy = unknown> = {
  config: DiveSchedulerConfig;
  getCandidates: () => DiveSchedulerCandidate<TEnemy>[];
  randomFloat?: () => number;
  onDiveTelegraph?: (payload: { enemyId?: string; leadMs: number }) => void;
};

type PendingDive = {
  controller: DiveSchedulerController;
  enemyId?: string;
  dueAtMs: number;
};

export class DiveScheduler<TEnemy = unknown> {
  private readonly config: DiveSchedulerConfig;
  private readonly getCandidates: DiveSchedulerOptions<TEnemy>['getCandidates'];
  private readonly randomFloat: () => number;
  private readonly onDiveTelegraph?: DiveSchedulerOptions<TEnemy>['onDiveTelegraph'];
  private attackTickAccumulatorMs = 0;
  private clockMs = 0;
  private pendingDives: PendingDive[] = [];

  constructor(options: DiveSchedulerOptions<TEnemy>) {
    this.config = options.config;
    this.getCandidates = options.getCandidates;
    this.randomFloat = options.randomFloat ?? Math.random;
    this.onDiveTelegraph = options.onDiveTelegraph;
  }

  update(simDtMs: number): void {
    if (simDtMs <= 0) {
      return;
    }

    const attackTickMs = this.config.attackTickMs;
    if (attackTickMs <= 0) {
      return;
    }

    this.clockMs += simDtMs;
    this.processPendingDives();

    this.attackTickAccumulatorMs += simDtMs;
    while (this.attackTickAccumulatorMs >= attackTickMs) {
      this.attackTickAccumulatorMs -= attackTickMs;
      this.processAttackTick();
    }
    this.processPendingDives();
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
    if (concurrentDivers + this.pendingDives.length >= maxConcurrentDivers) {
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
    const selected = eligible[index];
    if (!selected) {
      return;
    }

    const telegraphLeadMs = Math.max(0, this.config.telegraphLeadMs ?? 0);
    if (telegraphLeadMs <= 0) {
      selected.controller.startDive();
      return;
    }

    const hasPendingForController = this.pendingDives.some(
      (pending) => pending.controller === selected.controller,
    );
    if (hasPendingForController) {
      return;
    }
    this.onDiveTelegraph?.({
      enemyId: selected.enemyId,
      leadMs: telegraphLeadMs,
    });
    this.pendingDives.push({
      controller: selected.controller,
      enemyId: selected.enemyId,
      dueAtMs: this.clockMs + telegraphLeadMs,
    });
  }

  private processPendingDives(): void {
    if (this.pendingDives.length === 0) {
      return;
    }
    const remaining: PendingDive[] = [];
    for (const pending of this.pendingDives) {
      if (this.clockMs < pending.dueAtMs) {
        remaining.push(pending);
        continue;
      }
      if (pending.controller.state === EnemyLocalState.FORMATION) {
        pending.controller.startDive();
      }
    }
    this.pendingDives = remaining;
  }
}
