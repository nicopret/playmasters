import { RUN_EVENT, type TransitionReason } from './RunEvents';
import type { RunEventBus } from './RunEventBus';
import { RunState } from './RunState';
import { isAllowedTransition } from './RunTransitions';

type RunIntent =
  | { type: 'BOOT_COMPLETE' }
  | { type: 'START_REQUESTED' }
  | { type: 'RESPAWN_REQUESTED' }
  | { type: 'RUN_END_REQUESTED'; reason: string };

export type RunStateMachineConfig = {
  countdownMs: number;
  respawnDelayMs: number;
  runEndingDelayMs: number;
};

export type RunStateController = {
  onEnterState?: (
    state: RunState,
    from: RunState,
    reason: TransitionReason,
  ) => void;
  onExitState?: (
    state: RunState,
    to: RunState,
    reason: TransitionReason,
  ) => void;
  onCountdownTick?: (remainingMs: number) => void;
};

export class RunStateMachine {
  private readonly intents: RunIntent[] = [];
  private readonly unsubscribeFns: Array<() => void> = [];
  private _state: RunState = RunState.BOOT;
  private elapsedInStateMs = 0;

  constructor(
    private readonly bus: RunEventBus,
    private readonly config: RunStateMachineConfig,
    private readonly controller: RunStateController = {},
  ) {
    this.unsubscribeFns.push(
      this.bus.on(RUN_EVENT.REQUEST_BOOT_COMPLETE, () => {
        this.intents.push({ type: 'BOOT_COMPLETE' });
      }),
      this.bus.on(RUN_EVENT.REQUEST_START, () => {
        this.intents.push({ type: 'START_REQUESTED' });
      }),
      this.bus.on(RUN_EVENT.REQUEST_RESPAWN, () => {
        this.intents.push({ type: 'RESPAWN_REQUESTED' });
      }),
      this.bus.on(RUN_EVENT.REQUEST_END, ({ reason }) => {
        this.intents.push({ type: 'RUN_END_REQUESTED', reason });
      }),
    );
  }

  get state(): RunState {
    return this._state;
  }

  get timeInStateMs(): number {
    return this.elapsedInStateMs;
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribeFns) {
      unsubscribe();
    }
    this.unsubscribeFns.length = 0;
  }

  requestBootComplete(): void {
    this.bus.emit(RUN_EVENT.REQUEST_BOOT_COMPLETE, undefined);
  }

  requestStart(): void {
    this.bus.emit(RUN_EVENT.REQUEST_START, undefined);
  }

  requestRespawn(): void {
    this.bus.emit(RUN_EVENT.REQUEST_RESPAWN, undefined);
  }

  requestEndRun(reason = 'run_end_requested'): void {
    this.bus.emit(RUN_EVENT.REQUEST_END, { reason });
  }

  update(dtMs: number): void {
    if (dtMs < 0) {
      throw new Error('RunStateMachine requires non-negative dtMs.');
    }

    this.elapsedInStateMs += dtMs;
    this.processIntents();

    switch (this._state) {
      case RunState.COUNTDOWN: {
        const remaining = Math.max(
          0,
          this.config.countdownMs - this.elapsedInStateMs,
        );
        this.controller.onCountdownTick?.(remaining);
        this.bus.emit(RUN_EVENT.COUNTDOWN_TICK, { remainingMs: remaining });
        if (this.elapsedInStateMs >= this.config.countdownMs) {
          this.transition(RunState.PLAYING, 'countdown_complete');
        }
        break;
      }
      case RunState.PLAYER_RESPAWN: {
        if (this.elapsedInStateMs >= this.config.respawnDelayMs) {
          this.transition(RunState.COUNTDOWN, 'respawn_complete');
        }
        break;
      }
      case RunState.RUN_ENDING: {
        if (this.elapsedInStateMs >= this.config.runEndingDelayMs) {
          this.transition(RunState.RUN_ENDED, 'run_end_complete');
        }
        break;
      }
      default:
        break;
    }
  }

  private processIntents(): void {
    while (this.intents.length > 0) {
      const intent = this.intents.shift();
      if (!intent) return;
      switch (intent.type) {
        case 'BOOT_COMPLETE':
          if (this._state === RunState.BOOT) {
            this.transition(RunState.READY, 'boot_complete');
          }
          break;
        case 'START_REQUESTED':
          if (
            this._state === RunState.READY ||
            this._state === RunState.RUN_ENDED
          ) {
            this.transition(RunState.COUNTDOWN, 'start_requested');
          }
          break;
        case 'RESPAWN_REQUESTED':
          if (this._state === RunState.PLAYING) {
            this.transition(RunState.PLAYER_RESPAWN, 'player_died');
          }
          break;
        case 'RUN_END_REQUESTED':
          if (
            this._state === RunState.PLAYING ||
            this._state === RunState.PLAYER_RESPAWN ||
            this._state === RunState.COUNTDOWN
          ) {
            this.transition(RunState.RUN_ENDING, 'run_end_requested');
          }
          break;
        default:
          break;
      }
    }
  }

  private transition(next: RunState, reason: TransitionReason): void {
    const from = this._state;
    if (!isAllowedTransition(from, next)) {
      const message = `Illegal run state transition: ${from} -> ${next}`;
      this.bus.emit(RUN_EVENT.ERROR, { message });
      throw new Error(message);
    }

    this.controller.onExitState?.(from, next, reason);
    this._state = next;
    this.elapsedInStateMs = 0;
    this.bus.emit(RUN_EVENT.STATE_CHANGED, { from, to: next, reason });

    switch (next) {
      case RunState.READY:
        this.bus.emit(RUN_EVENT.READY, undefined);
        break;
      case RunState.PLAYING:
        this.bus.emit(RUN_EVENT.PLAYING, undefined);
        break;
      case RunState.PLAYER_RESPAWN:
        this.bus.emit(RUN_EVENT.PLAYER_RESPAWN, undefined);
        break;
      case RunState.RUN_ENDING:
        this.bus.emit(RUN_EVENT.ENDING, undefined);
        break;
      case RunState.RUN_ENDED:
        this.bus.emit(RUN_EVENT.ENDED, undefined);
        break;
      case RunState.ERROR:
        this.bus.emit(RUN_EVENT.ERROR, { message: 'Run entered ERROR state.' });
        break;
      default:
        break;
    }

    this.controller.onEnterState?.(next, from, reason);
  }
}
