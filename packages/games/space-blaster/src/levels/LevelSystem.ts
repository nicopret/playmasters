import type {
  ResolvedLevelConfigV1,
  ResolvedLevelWaveV1,
} from '@playmasters/types';
import type { RunContext } from '../runtime';
import { RunState } from '../run';

type LevelFormationPort = {
  spawnFormation: (wave: ResolvedLevelWaveV1) => void;
};

type LevelRunStatePort = {
  requestWaveClear: () => void;
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
  private waveClearRequested = false;

  constructor(options: LevelSystemOptions) {
    this.ctx = options.ctx;
    this.runStateMachine = options.runStateMachine;
    this.formationSystem = options.formationSystem;
    this.getActiveEnemyCount = options.getActiveEnemyCount;
    this.onWaveStarted = options.onWaveStarted;
  }

  startLevel(levelIndex = 0): void {
    this.activeLevelIndex = Math.max(0, levelIndex);
    this.activeWaveIndex = 0;
    this.waveClearRequested = false;
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

    if (state === RunState.WAVE_CLEAR && !this.hasNextWave()) {
      this.runStateMachine.requestEndRun('all_waves_cleared');
    }
  }

  update(simDtMs: number): void {
    if (simDtMs <= 0 || this.waveClearRequested) return;
    if (this.getActiveEnemyCount() > 0) return;
    this.forceWaveClear('enemies_depleted');
  }

  forceWaveClear(reason: 'enemies_depleted' | 'ENRAGE_TIMEOUT'): void {
    void reason;
    if (this.waveClearRequested) return;
    this.waveClearRequested = true;
    this.runStateMachine.requestWaveClear();
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
    this.waveClearRequested = false;
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
    this.waveClearRequested = false;
  }

  private getActiveLevel(): ResolvedLevelConfigV1 | undefined {
    return this.ctx.resolvedConfig.levelConfigs[this.activeLevelIndex];
  }
}
