import { RunState } from '../run';
import {
  OverlayState,
  OverlayStateMachine,
} from '../overlay/OverlayStateMachine';

type OverlayCoordinatorOptions = {
  overlay: OverlayStateMachine;
  onOverlayChanged: (state: OverlayState, blocksGameplay: boolean) => void;
  onRestartRequested: () => void;
};

export class OverlayCoordinator {
  private readonly overlay: OverlayStateMachine;
  private readonly onOverlayChanged: OverlayCoordinatorOptions['onOverlayChanged'];
  private readonly onRestartRequested: OverlayCoordinatorOptions['onRestartRequested'];

  constructor(options: OverlayCoordinatorOptions) {
    this.overlay = options.overlay;
    this.onOverlayChanged = options.onOverlayChanged;
    this.onRestartRequested = options.onRestartRequested;
    this.emitState();
  }

  syncFromRunState(state: RunState): void {
    if (state === RunState.RESULTS) {
      this.dispatch('SHOW_RESULTS');
      return;
    }

    if (this.overlay.getState() === OverlayState.RESULTS) {
      this.dispatch('HIDE_RESULTS');
    }
  }

  requestPause(): void {
    this.dispatch('OPEN_PAUSE');
  }

  requestResume(): void {
    this.dispatch('CLOSE_PAUSE');
  }

  requestOpenSettings(): void {
    this.dispatch('OPEN_SETTINGS');
  }

  requestCloseSettings(): void {
    this.dispatch('CLOSE_SETTINGS');
  }

  requestRestart(): void {
    const outcome = this.overlay.dispatch('RESTART_REQUESTED');
    this.emitState();
    if (outcome.restartRequested) {
      this.onRestartRequested();
    }
  }

  private dispatch(
    event:
      | 'OPEN_PAUSE'
      | 'CLOSE_PAUSE'
      | 'OPEN_SETTINGS'
      | 'CLOSE_SETTINGS'
      | 'SHOW_RESULTS'
      | 'HIDE_RESULTS',
  ): void {
    this.overlay.dispatch(event);
    this.emitState();
  }

  private emitState(): void {
    this.onOverlayChanged(
      this.overlay.getState(),
      this.overlay.getBlocksGameplay(),
    );
  }
}
