import type {
  ResolvedLevelConfigV1,
  ResolvedLevelWaveV1,
} from '@playmasters/types';
import type { RunContext } from '../runtime';
import { RunState } from '../run';

type LevelFormationPort = {
  setLevelIndex?: (levelIndex: number) => void;
  spawnFormation: (wave: ResolvedLevelWaveV1) => void;
};

type LevelRunStatePort = {
  requestWaveClear: () => void;
  requestLevelComplete: () => void;
  requestEndRun: (reason?: string) => void;
};

type LevelSystemOptions = {
  ctx: RunContext;
  runStateMachine: LevelRunStatePort;
  formationSystem: LevelFormationPort;
  getActiveEnemyCount: () => number;
  onWaveStarted?: (payload: {
    levelIndex: number;
    waveIndex: number;
    wave: ResolvedLevelWaveV1;
    level: ResolvedLevelConfigV1;
  }) => void;
};

export class LevelSystem {
  private readonly ctx: RunContext;
  private readonly runStateMachine: LevelRunStatePort;
  private readonly formationSystem: LevelFormationPort;
  private readonly getActiveEnemyCount: LevelSystemOptions['getActiveEnemyCount'];
  private readonly onWaveStarted?: LevelSystemOptions['onWaveStarted'];
  private activeLevelIndex = 0;
  private activeWaveIndex = 0;
  private progressionRequested = false;

  constructor(options: LevelSystemOptions) {
    this.ctx = options.ctx;
    this.runStateMachine = options.runStateMachine;
    this.formationSystem = options.formationSystem;
    this.getActiveEnemyCount = options.getActiveEnemyCount;
    this.onWaveStarted = options.onWaveStarted;
  }

  startLevel(levelIndex = 0): void {
    this.activeLevelIndex = this.clampLevelIndex(levelIndex);
    this.activeWaveIndex = 0;
    this.progressionRequested = false;
  }

  onEnterRunState(state: RunState, from: RunState): void {
    if (state === RunState.COUNTDOWN) {
      if (from === RunState.READY || from === RunState.RESULTS) {
        this.startLevel(this.activeLevelIndex);
      } else if (from === RunState.WAVE_CLEAR) {
        this.advanceToNextWave();
      }
      return;
    }

    if (state === RunState.PLAYING) {
      this.startWave(this.activeWaveIndex);
      return;
    }

    if (state === RunState.LEVEL_COMPLETE) {
      if (this.hasNextLevel()) {
        this.initializeNextLevel();
        return;
      }
      this.runStateMachine.requestEndRun('all_levels_cleared');
      return;
    }

    if (
      state === RunState.WAVE_CLEAR &&
      !this.hasNextWave() &&
      !this.hasNextLevel()
    ) {
      this.runStateMachine.requestEndRun('all_levels_cleared');
    }
  }

  update(simDtMs: number): void {
    if (simDtMs <= 0 || this.progressionRequested) return;
    if (this.getActiveEnemyCount() > 0) return;
    this.requestProgression('enemies_depleted');
  }

  forceWaveClear(reason: 'enemies_depleted' | 'ENRAGE_TIMEOUT'): void {
    this.requestProgression(reason);
  }

  hasNextWave(): boolean {
    const level = this.getActiveLevel();
    if (!level?.waves || level.waves.length === 0) return false;
    return this.activeWaveIndex + 1 < level.waves.length;
  }

  getActiveWave(): ResolvedLevelWaveV1 | undefined {
    const level = this.getActiveLevel();
    if (!level?.waves || level.waves.length === 0) return undefined;
    return level.waves[this.activeWaveIndex];
  }

  getLevelNumber(): number {
    return this.activeLevelIndex + 1;
  }

  getWaveIndex(): number {
    return this.activeWaveIndex;
  }

  private startWave(waveIndex: number): void {
    const level = this.getActiveLevel();
    if (!level || !level.waves || level.waves.length === 0) return;
    const clampedWaveIndex = Math.max(
      0,
      Math.min(level.waves.length - 1, waveIndex),
    );
    const wave = level.waves[clampedWaveIndex];
    if (!wave) return;
    this.activeWaveIndex = clampedWaveIndex;
    this.progressionRequested = false;
    this.formationSystem.setLevelIndex?.(this.activeLevelIndex);
    this.formationSystem.spawnFormation(wave);
    this.onWaveStarted?.({
      levelIndex: this.activeLevelIndex,
      waveIndex: this.activeWaveIndex,
      wave,
      level,
    });
  }

  private advanceToNextWave(): void {
    if (this.hasNextWave()) {
      this.activeWaveIndex += 1;
    }
    this.progressionRequested = false;
  }

  private initializeNextLevel(): void {
    if (!this.hasNextLevel()) return;
    this.activeLevelIndex += 1;
    this.activeWaveIndex = 0;
    this.progressionRequested = false;
  }

  private hasNextLevel(): boolean {
    // Selection rule: advance linearly through resolvedConfig.levelConfigs by index.
    return (
      this.activeLevelIndex + 1 < this.ctx.resolvedConfig.levelConfigs.length
    );
  }

  private requestProgression(
    reason: 'enemies_depleted' | 'ENRAGE_TIMEOUT',
  ): void {
    if (this.progressionRequested) return;
    this.progressionRequested = true;
    const hasMoreWaves = this.hasNextWave();
    if (hasMoreWaves) {
      this.runStateMachine.requestWaveClear();
      return;
    }
    if (this.hasNextLevel()) {
      this.runStateMachine.requestLevelComplete();
      return;
    }
    this.runStateMachine.requestEndRun(
      reason === 'ENRAGE_TIMEOUT'
        ? 'all_levels_cleared_enrage_timeout'
        : 'all_levels_cleared',
    );
  }

  private clampLevelIndex(levelIndex: number): number {
    const maxIndex = Math.max(
      0,
      this.ctx.resolvedConfig.levelConfigs.length - 1,
    );
    return Math.max(0, Math.min(maxIndex, levelIndex));
  }

  private getActiveLevel(): ResolvedLevelConfigV1 | undefined {
    return this.ctx.resolvedConfig.levelConfigs[this.activeLevelIndex];
  }
}
