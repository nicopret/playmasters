export enum OverlayState {
  NONE = 'NONE',
  PAUSED = 'PAUSED',
  SETTINGS = 'SETTINGS',
  RESULTS = 'RESULTS',
}

export type OverlayEvent =
  | 'OPEN_PAUSE'
  | 'CLOSE_PAUSE'
  | 'OPEN_SETTINGS'
  | 'CLOSE_SETTINGS'
  | 'SHOW_RESULTS'
  | 'HIDE_RESULTS'
  | 'RESTART_REQUESTED';

const ALLOWED_TRANSITIONS: Record<OverlayState, ReadonlySet<OverlayState>> = {
  [OverlayState.NONE]: new Set([OverlayState.PAUSED, OverlayState.RESULTS]),
  [OverlayState.PAUSED]: new Set([OverlayState.NONE, OverlayState.SETTINGS]),
  [OverlayState.SETTINGS]: new Set([OverlayState.PAUSED, OverlayState.NONE]),
  [OverlayState.RESULTS]: new Set([OverlayState.NONE]),
};

const BLOCKING_STATES = new Set<OverlayState>([
  OverlayState.PAUSED,
  OverlayState.SETTINGS,
  OverlayState.RESULTS,
]);

export class OverlayStateMachine {
  private stateValue: OverlayState = OverlayState.NONE;

  getState(): OverlayState {
    return this.stateValue;
  }

  getBlocksGameplay(): boolean {
    return BLOCKING_STATES.has(this.stateValue);
  }

  dispatch(event: OverlayEvent): { restartRequested: boolean } {
    switch (event) {
      case 'OPEN_PAUSE':
        this.transition(OverlayState.PAUSED);
        return { restartRequested: false };
      case 'CLOSE_PAUSE':
        this.transition(OverlayState.NONE);
        return { restartRequested: false };
      case 'OPEN_SETTINGS':
        this.transition(OverlayState.SETTINGS);
        return { restartRequested: false };
      case 'CLOSE_SETTINGS':
        this.transition(OverlayState.PAUSED);
        return { restartRequested: false };
      case 'SHOW_RESULTS':
        if (this.stateValue === OverlayState.RESULTS) {
          return { restartRequested: false };
        }
        this.transition(OverlayState.RESULTS);
        return { restartRequested: false };
      case 'HIDE_RESULTS':
        if (this.stateValue === OverlayState.RESULTS) {
          this.transition(OverlayState.NONE);
        }
        return { restartRequested: false };
      case 'RESTART_REQUESTED':
        if (
          this.stateValue !== OverlayState.RESULTS &&
          this.stateValue !== OverlayState.PAUSED &&
          this.stateValue !== OverlayState.SETTINGS
        ) {
          throw new Error(
            `Illegal overlay action: RESTART_REQUESTED from ${this.stateValue}`,
          );
        }
        this.transition(OverlayState.NONE);
        return { restartRequested: true };
      default: {
        const exhaustiveCheck: never = event;
        throw new Error(`Unknown overlay event: ${String(exhaustiveCheck)}`);
      }
    }
  }

  private transition(next: OverlayState): void {
    const current = this.stateValue;
    if (current === next) return;
    if (!ALLOWED_TRANSITIONS[current].has(next)) {
      throw new Error(`Illegal overlay transition: ${current} -> ${next}`);
    }
    this.stateValue = next;
  }
}
