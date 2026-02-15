import * as Phaser from 'phaser';
import type {
  EmbeddedGame,
  EmbeddedGameSdk,
  EnemyCatalogEntryV1,
  ResolvedLevelConfigV1,
  ResolvedGameConfigV1,
} from '@playmasters/types';
import {
  createBootstrapDependencies,
  type SpaceBlasterBootstrapDeps,
} from './bootstrap';
import { DisposableBag, createRunContext } from './runtime';
import {
  orchestrateRunFrame,
  RUN_EVENT,
  RunEventBus,
  RunState,
  RunStateMachine,
} from './run';
import { PlayerController } from './systems/PlayerController';
import { PlayerLifeSystem } from './systems/PlayerLifeSystem';
import { WeaponSystem } from './systems/WeaponSystem';
import { FormationSystem } from './systems/FormationSystem';
import { EnemyFireSystem } from './systems/EnemyFireSystem';
import { EnemyController } from './enemies/EnemyController';
import { DiveScheduler } from './enemies/DiveScheduler';
import { EnemyLocalState } from './enemies/EnemyLocalState';
import { LevelSystem } from './levels/LevelSystem';
import { ScoreSystem } from './scoring';

type MountOptions = {
  deps: SpaceBlasterBootstrapDeps;
  onReady?: () => void;
  onGameOver?: (finalScore: number) => void;
  disposables: DisposableBag;
};

const GAME_ID = 'game-space-blaster';
const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 450;
const ENEMY_WIDTH = 34;
const ENEMY_HEIGHT = 24;
const ENEMY_COLOR = 0xe94b5a;
const DEFAULT_RESPAWN_INVULNERABILITY_MS = 1200;
const COUNTDOWN_MS = 1200;
const RESPAWN_DELAY_MS = 650;
const WAVE_CLEAR_MS = 750;
const LEVEL_COMPLETE_MS = 900;
const RUN_ENDING_DELAY_MS = 900;

class SpaceBlasterScene extends Phaser.Scene {
  private deps: SpaceBlasterBootstrapDeps;
  private onReady?: () => void;
  private onGameOver?: (score: number) => void;
  private disposables: DisposableBag;

  private player!: Phaser.GameObjects.Rectangle;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private playerController!: PlayerController;
  private lifeSystem!: PlayerLifeSystem;
  private formationSystem!: FormationSystem;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private weaponSystem!: WeaponSystem;
  private enemyWeaponSystem!: WeaponSystem;
  private enemyFireSystem?: EnemyFireSystem;
  private diveScheduler?: DiveScheduler<Phaser.GameObjects.Rectangle>;
  private levelSystem!: LevelSystem;
  private scoreSystem!: ScoreSystem;
  private enemies!: Phaser.Physics.Arcade.Group;
  private enemyControllers = new Map<
    Phaser.GameObjects.Rectangle,
    EnemyController
  >();
  private enemyCanDive = new Map<Phaser.GameObjects.Rectangle, boolean>();
  private enemyProfile = new Map<
    Phaser.GameObjects.Rectangle,
    EnemyCatalogEntryV1 | undefined
  >();

  private score = 0;
  private startTime: number | null = null;
  private canSubmitScore = true;
  private submitting = false;
  private runStarted = false;
  private startRequested = false;
  private simNowMs = 0;

  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private playAgainBtn!: Phaser.GameObjects.Text;

  private keyboardSpaceHandler?: () => void;
  private pointerDownHandler?: () => void;
  private visibilityChangeHandler?: () => void;
  private blurHandler?: () => void;
  private focusHandler?: () => void;
  private overlayBlockingGameplay = false;
  private runBus = new RunEventBus();
  private runStateMachine = new RunStateMachine(
    this.runBus,
    {
      countdownMs: COUNTDOWN_MS,
      respawnDelayMs: RESPAWN_DELAY_MS,
      waveClearMs: WAVE_CLEAR_MS,
      levelCompleteMs: LEVEL_COMPLETE_MS,
      runEndingDelayMs: RUN_ENDING_DELAY_MS,
    },
    {
      onEnterState: (state, from) => this.onEnterRunState(state, from),
      onCountdownTick: (remainingMs) => this.onCountdownTick(remainingMs),
    },
  );

  constructor(opts: MountOptions) {
    super('space-blaster');
    this.deps = opts.deps;
    this.onReady = opts.onReady;
    this.onGameOver = opts.onGameOver;
    this.disposables = opts.disposables;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0f111a');
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    const backdrop = this.add.rectangle(
      WORLD_WIDTH / 2,
      WORLD_HEIGHT / 2,
      WORLD_WIDTH,
      WORLD_HEIGHT,
      0x101628,
    );
    backdrop.setStrokeStyle(2, 0x3aa9e0, 0.35);

    this.player = this.add.rectangle(
      WORLD_WIDTH / 2,
      WORLD_HEIGHT - 60,
      52,
      26,
      0x3aa9e0,
    );
    this.physics.add.existing(this.player);
    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setCollideWorldBounds(true);

    const heroEntry = this.deps.heroCatalog.entries[0];
    const moveSpeed =
      heroEntry?.moveSpeed && heroEntry.moveSpeed > 0
        ? heroEntry.moveSpeed
        : 380;
    const initialLives =
      heroEntry?.maxLives && heroEntry.maxLives > 0
        ? heroEntry.maxLives
        : this.deps.gameConfig.defaultLives;

    this.lifeSystem = new PlayerLifeSystem(
      initialLives,
      DEFAULT_RESPAWN_INVULNERABILITY_MS,
    );

    this.playerController = new PlayerController(
      this.player,
      this.playerBody,
      () => {
        const bounds = this.physics.world.bounds;
        return { minX: bounds.x, maxX: bounds.x + bounds.width };
      },
      moveSpeed,
    );

    const ammoEntry = this.deps.ammoCatalog.entries.find(
      (entry) => entry.ammoId === heroEntry?.defaultAmmoId,
    );
    this.weaponSystem = new WeaponSystem(
      this,
      () => {
        const world = this.physics.world.bounds;
        return {
          minX: world.x,
          maxX: world.x + world.width,
          minY: world.y,
          maxY: world.y + world.height,
        };
      },
      {
        fireCooldownMs: ammoEntry?.fireCooldownMs ?? 200,
        projectileSpeed: ammoEntry?.projectileSpeed ?? 560,
        poolSize: 48,
      },
    );
    const levelConfig = this.deps.levelConfigs[0];
    const firstWave = levelConfig?.waves?.[0];
    const enemyEntry = this.deps.enemyCatalog.entries.find(
      (entry) => entry.enemyId === firstWave?.enemyId,
    );
    this.enemyWeaponSystem = new WeaponSystem(
      this,
      () => {
        const world = this.physics.world.bounds;
        return {
          minX: world.x,
          maxX: world.x + world.width,
          minY: world.y,
          maxY: world.y + world.height,
        };
      },
      {
        fireCooldownMs:
          enemyEntry?.projectileCooldownMs ?? ammoEntry?.fireCooldownMs ?? 200,
        projectileSpeed: ammoEntry?.projectileSpeed ?? 560,
        poolSize: 48,
        projectileColor: ENEMY_COLOR,
      },
    );

    this.enemies = this.physics.add.group({ runChildUpdate: true });
    this.formationSystem = new FormationSystem({
      ctx: this.deps.ctx,
      playBounds: () => {
        const world = this.physics.world.bounds;
        return {
          minX: world.x,
          maxX: world.x + world.width,
          minY: world.y,
        };
      },
      enemyManager: {
        spawnEnemy: (_enemyId, x, y) => {
          const enemyEntry = this.deps.enemyCatalog.entries.find(
            (entry) => entry.enemyId === _enemyId,
          );
          const enemy = this.add.rectangle(
            x,
            y,
            ENEMY_WIDTH,
            ENEMY_HEIGHT,
            ENEMY_COLOR,
          );
          this.physics.add.existing(enemy);
          const body = enemy.body as Phaser.Physics.Arcade.Body;
          body.setAllowGravity(false);
          body.setVelocity(0);
          body.setCircle(12);
          this.enemies.add(enemy);
          this.enemyCanDive.set(enemy, enemyEntry?.canDive !== false);
          this.enemyProfile.set(enemy, enemyEntry);
          return enemy;
        },
        getActiveEnemies: () =>
          this.enemies
            .getChildren()
            .filter((enemy) => (enemy as Phaser.GameObjects.Rectangle).active)
            .map((enemy) => enemy as Phaser.GameObjects.Rectangle),
        clearEnemies: () => {
          this.enemyCanDive.clear();
          this.enemyProfile.clear();
          this.enemies.clear(true, true);
        },
      },
      onForceWaveComplete: () => {
        this.levelSystem.forceWaveClear('ENRAGE_TIMEOUT');
      },
    });
    this.levelSystem = new LevelSystem({
      ctx: this.deps.ctx,
      bus: this.runBus,
      runStateMachine: this.runStateMachine,
      formationSystem: this.formationSystem,
      getActiveEnemyCount: () => this.enemies.countActive(true),
      getWaveClearContext: () => ({
        nowMs: this.simNowMs,
        livesRemaining: this.lifeSystem.lives,
      }),
      onWaveStarted: ({ wave, level }) => {
        this.diveScheduler = this.createDiveScheduler(wave.enemyId, level);
        this.enemyFireSystem = this.createEnemyFireSystem(level);
        this.initializeEnemyControllers(level);
      },
    });
    this.scoreSystem = new ScoreSystem({
      ctx: this.deps.ctx,
      bus: this.runBus,
      getLevelNumber: () => this.levelSystem.getLevelNumber(),
    });
    this.disposables.add(
      this.runBus.on(RUN_EVENT.LEVEL_WAVE_CLEARED, () => {
        this.syncScoreFromSystem();
      }),
    );

    this.scoreText = this.add.text(16, 12, 'Score: 0', {
      fontFamily: 'Montserrat, Arial, sans-serif',
      fontSize: '18px',
      color: '#f9d65c',
    });
    this.livesText = this.add.text(16, 34, `Lives: ${this.lifeSystem.lives}`, {
      fontFamily: 'Montserrat, Arial, sans-serif',
      fontSize: '16px',
      color: '#d5d8e0',
    });

    this.statusText = this.add.text(16, 58, 'Press space or tap to start', {
      fontFamily: 'Montserrat, Arial, sans-serif',
      fontSize: '14px',
      color: '#d5d8e0',
    });

    this.playAgainBtn = this.add
      .text(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 'Play again', {
        fontFamily: 'Montserrat, Arial, sans-serif',
        fontSize: '20px',
        color: '#0e0e0e',
        backgroundColor: '#f9d65c',
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);

    this.playAgainBtn.on('pointerup', () => this.restartGame());

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is unavailable');
    }
    this.cursors = keyboard.createCursorKeys();
    this.keyboardSpaceHandler = () => this.handleSpace();
    this.pointerDownHandler = () => this.handleSpace();
    keyboard.on('keydown-SPACE', this.keyboardSpaceHandler);
    this.input.on('pointerdown', this.pointerDownHandler);

    this.disposables.add(() => {
      if (this.keyboardSpaceHandler) {
        keyboard.off('keydown-SPACE', this.keyboardSpaceHandler);
      }
      if (this.pointerDownHandler) {
        this.input.off('pointerdown', this.pointerDownHandler);
      }
    });

    if (typeof document !== 'undefined') {
      this.overlayBlockingGameplay = document.hidden;
      this.visibilityChangeHandler = () => {
        this.overlayBlockingGameplay = document.hidden;
      };
      document.addEventListener(
        'visibilitychange',
        this.visibilityChangeHandler,
      );
      this.disposables.add(() => {
        if (this.visibilityChangeHandler) {
          document.removeEventListener(
            'visibilitychange',
            this.visibilityChangeHandler,
          );
        }
      });
    }

    if (typeof window !== 'undefined') {
      this.blurHandler = () => {
        this.overlayBlockingGameplay = true;
      };
      this.focusHandler = () => {
        this.overlayBlockingGameplay = false;
      };
      window.addEventListener('blur', this.blurHandler);
      window.addEventListener('focus', this.focusHandler);
      this.disposables.add(() => {
        if (this.blurHandler) {
          window.removeEventListener('blur', this.blurHandler);
        }
        if (this.focusHandler) {
          window.removeEventListener('focus', this.focusHandler);
        }
      });
    }

    this.physics.add.overlap(
      this.weaponSystem.projectileGroup,
      this.enemies,
      (bullet, enemy) => {
        this.weaponSystem.releaseProjectile(
          bullet as Phaser.GameObjects.Rectangle,
        );
        const target = enemy as Phaser.GameObjects.Rectangle;
        this.enemyControllers.get(target)?.setDead();
        this.enemyControllers.delete(target);
        this.enemyCanDive.delete(target);
        const enemyId = this.enemyProfile.get(target)?.enemyId;
        this.enemyProfile.delete(target);
        this.runBus.emit(RUN_EVENT.PLAYER_SHOT_HIT, { nowMs: this.simNowMs });
        this.formationSystem.onEnemyDeath(target);
        target.destroy();
        if (enemyId) {
          this.runBus.emit(RUN_EVENT.ENEMY_KILLED, {
            enemyId,
            nowMs: this.simNowMs,
          });
          this.syncScoreFromSystem();
        }
      },
      undefined,
      this,
    );

    this.physics.add.overlap(
      this.enemies,
      this.player,
      () => this.handlePlayerHit(),
      undefined,
      this,
    );
    this.physics.add.overlap(
      this.enemyWeaponSystem.projectileGroup,
      this.player,
      (projectile) => {
        this.enemyWeaponSystem.releaseProjectile(
          projectile as Phaser.GameObjects.Rectangle,
        );
        this.handlePlayerHit();
      },
      undefined,
      this,
    );

    this.runStateMachine.requestBootComplete();
    this.runStateMachine.update(0);
  }

  override update(_time: number, delta: number) {
    orchestrateRunFrame({
      deltaMs: delta,
      overlayBlockingGameplay: this.overlayBlockingGameplay,
      getState: () => this.runStateMachine.state,
      advanceRunStateMachine: (dtMs) => this.runStateMachine.update(dtMs),
      setPhysicsPaused: (paused) => {
        if (this.physics.world.isPaused !== paused) {
          this.physics.world.isPaused = paused;
        }
      },
      advanceSimulation: (dtMs) => {
        this.simNowMs += dtMs;
        const inputAxis = this.cursors.left?.isDown
          ? -1
          : this.cursors.right?.isDown
            ? 1
            : 0;
        this.playerController.update(dtMs, inputAxis);
        this.lifeSystem.update(dtMs);

        if (this.cursors.space?.isDown) {
          this.fireManualShot();
        }

        this.formationSystem.update(dtMs);
        this.updateEnemyControllers(dtMs);
        this.diveScheduler?.update(dtMs);
        this.enemyFireSystem?.update(dtMs);

        this.enemies.children.each((enemy) => {
          const e = enemy as Phaser.GameObjects.Rectangle;
          if (e.y > WORLD_HEIGHT - 12) {
            this.runStateMachine.requestEndRun('enemy_breach');
          }
          return false;
        });

        this.levelSystem.update(dtMs);

        this.weaponSystem.update(dtMs);
        this.enemyWeaponSystem.update(dtMs);
      },
    });

    if (this.lifeSystem.invulnerable) {
      const flashVisible = Math.floor(_time / 80) % 2 === 0;
      this.player.setAlpha(flashVisible ? 0.5 : 1);
      return;
    }
    this.player.setAlpha(1);
  }

  private handleSpace() {
    if (
      this.runStateMachine.state === RunState.READY ||
      this.runStateMachine.state === RunState.RESULTS
    ) {
      if (!this.startRequested) {
        this.startRequested = true;
        this.runStateMachine.requestStart();
      }
      return;
    }
    if (this.runStateMachine.state === RunState.PLAYING) {
      this.fireManualShot();
    }
  }

  private resetEntities() {
    this.formationSystem.clear();
    this.enemyControllers.clear();
    this.weaponSystem.clear();
    this.enemyWeaponSystem.clear();
    this.enemyFireSystem = undefined;
    this.diveScheduler = undefined;
    this.enemyCanDive.clear();
    this.enemyProfile.clear();
    this.player.setPosition(WORLD_WIDTH / 2, WORLD_HEIGHT - 60);
    this.playerController.resetPosition(WORLD_WIDTH / 2);
    this.playerBody.setVelocity(0);
    this.playerBody.enable = true;
    this.player.setVisible(true);
    this.player.setAlpha(1);
  }

  private fireManualShot() {
    if (this.runStateMachine.state !== RunState.PLAYING) return;
    if (this.lifeSystem.invulnerable) return;
    const fired = this.weaponSystem.tryFire(
      this.player.x,
      this.player.y - 20,
      -1,
    );
    if (!fired) return;
    this.runBus.emit(RUN_EVENT.PLAYER_SHOT_FIRED, { nowMs: this.simNowMs });
  }

  private updateLivesDisplay() {
    this.livesText.setText(`Lives: ${this.lifeSystem.lives}`);
  }

  private handlePlayerHit() {
    if (this.runStateMachine.state !== RunState.PLAYING) return;

    const hitResult = this.lifeSystem.onPlayerHit();
    if (hitResult.kind === 'ignored') {
      return;
    }
    this.runBus.emit(RUN_EVENT.PLAYER_HIT, { nowMs: this.simNowMs });

    this.updateLivesDisplay();
    if (hitResult.kind === 'end_run') {
      this.runStateMachine.requestEndRun('player_death');
      return;
    }

    this.runStateMachine.requestRespawn();
  }

  private async submitScoreIfNeeded() {
    if (!this.canSubmitScore || this.submitting) {
      this.onGameOver?.(this.score);
      return;
    }

    this.submitting = true;
    const durationMs = this.startTime ? Date.now() - this.startTime : undefined;

    try {
      this.statusText.setText('Submitting...');
      await this.deps.sdk.submitScore({ score: this.score, durationMs });
      this.statusText.setText('Score submitted');
      window.dispatchEvent(
        new CustomEvent('playmasters:refresh-leaderboard', {
          detail: { gameId: GAME_ID },
        }),
      );
    } catch {
      this.statusText.setText('Error submitting score');
    } finally {
      this.submitting = false;
      this.onGameOver?.(this.score);
    }
  }

  private beginNewRunSession() {
    this.runStarted = false;
    this.startRequested = false;
    this.score = 0;
    this.startTime = null;
    this.simNowMs = 0;
    this.canSubmitScore = true;
    this.lifeSystem.reset();
    this.updateLivesDisplay();
    this.levelSystem.startLevel(0);
    this.scoreSystem.resetForNewRun();
    this.syncScoreFromSystem();
  }

  private async ensureRunStarted() {
    if (this.runStarted) return;
    this.runStarted = true;
    this.startTime = Date.now();
    try {
      await this.deps.sdk.startRun();
    } catch {
      this.canSubmitScore = false;
      this.statusText.setText('Sign in to submit score');
    }
  }

  private onCountdownTick(remainingMs: number) {
    const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
    this.statusText.setText(`Starting in ${seconds}...`);
  }

  private createDiveScheduler(
    waveEnemyId: string,
    level: ResolvedLevelConfigV1,
  ): DiveScheduler<Phaser.GameObjects.Rectangle> | undefined {
    const waveEnemy = this.deps.enemyCatalog.entries.find(
      (entry) => entry.enemyId === waveEnemyId,
    );
    const attackTickMs =
      level?.diveScheduler?.attackTickMs ??
      level?.attackTickMs ??
      waveEnemy?.diveCooldownMs ??
      0;
    const diveChancePerTick = Math.max(
      0,
      Math.min(
        1,
        level?.diveScheduler?.diveChancePerTick ??
          level?.diveChancePerTick ??
          (typeof level?.dive === 'number' ? level.dive / 100 : 0),
      ),
    );
    const maxConcurrentDivers = Math.max(
      0,
      Math.floor(
        level?.diveScheduler?.maxConcurrentDivers ??
          level?.maxConcurrentDivers ??
          1,
      ),
    );

    if (
      attackTickMs <= 0 ||
      diveChancePerTick <= 0 ||
      maxConcurrentDivers <= 0
    ) {
      return undefined;
    }

    return new DiveScheduler({
      config: {
        attackTickMs,
        diveChancePerTick,
        maxConcurrentDivers,
      },
      getCandidates: () => {
        const candidates: Array<{
          enemy: Phaser.GameObjects.Rectangle;
          active: boolean;
          canDive: boolean;
          controller: EnemyController;
        }> = [];
        this.enemyControllers.forEach((controller, enemy) => {
          candidates.push({
            enemy,
            active: enemy.active,
            canDive: this.enemyCanDive.get(enemy) ?? true,
            controller,
          });
        });
        return candidates;
      },
    });
  }

  private createEnemyFireSystem(level: ResolvedLevelConfigV1): EnemyFireSystem {
    const fireChancePerSecond =
      typeof level?.shooting === 'number' && level.shooting > 0
        ? level.shooting / 100
        : 0;
    return new EnemyFireSystem({
      formation: this.formationSystem,
      weapon: this.enemyWeaponSystem,
      fireChancePerSecond,
      muzzleOffsetY: ENEMY_HEIGHT / 2,
    });
  }

  private initializeEnemyControllers(level: ResolvedLevelConfigV1): void {
    this.enemyControllers.clear();
    const baseSpeed =
      this.formationSystem.getMotionDiagnostics().baseFleetSpeed;
    const currentWave = this.levelSystem.getActiveWave();
    const arrivalThresholdPx = ENEMY_WIDTH / 8;
    const worldBounds = this.physics.world.bounds;
    const fallbackReturnTriggerY =
      worldBounds.y + worldBounds.height + ENEMY_HEIGHT;
    for (const enemy of this.formationSystem.getManagedEnemies()) {
      const profile = this.enemyProfile.get(
        enemy as Phaser.GameObjects.Rectangle,
      );
      const divePattern =
        profile?.divePattern ?? level?.diveMotion?.divePattern ?? 'straight';
      const diveSpeedPxPerSecond =
        profile?.diveSpeed ?? level?.diveMotion?.diveSpeed ?? baseSpeed;
      const maxDiveDurationMs =
        profile?.maxDiveDurationMs ??
        level?.diveMotion?.maxDiveDurationMs ??
        currentWave?.spawnDelayMs ??
        RESPAWN_DELAY_MS;
      const returnTriggerY =
        profile?.returnTriggerY ??
        level?.diveMotion?.returnTriggerY ??
        fallbackReturnTriggerY;
      const controller = new EnemyController({
        enemy,
        getReservedSlotPose: () =>
          this.formationSystem.getReservedSlotWorldPose(enemy),
        getPlayerPose: () => ({ x: this.player.x, y: this.player.y }),
        onLocalStateChanged: (state) =>
          this.formationSystem.setEnemyLocalState(enemy, state),
        divePattern,
        diveSpeedPxPerSecond,
        sineAmplitudePx:
          profile?.sineAmplitude ?? level?.diveMotion?.sineAmplitude ?? 0,
        sineFrequencyHz:
          profile?.sineFrequency ?? level?.diveMotion?.sineFrequency ?? 0,
        turnRateDegPerSecond:
          profile?.turnRate ?? level?.diveMotion?.turnRate ?? 0,
        returnSpeedPxPerSecond: baseSpeed,
        maxDiveDurationMs,
        returnTriggerY,
        arrivalThresholdPx,
      });
      this.enemyControllers.set(
        enemy as Phaser.GameObjects.Rectangle,
        controller,
      );
      this.formationSystem.setEnemyLocalState(enemy, EnemyLocalState.FORMATION);
    }
  }

  private updateEnemyControllers(simDtMs: number): void {
    this.enemyControllers.forEach((controller, enemy) => {
      controller.update(simDtMs);
      if (controller.state === EnemyLocalState.DEAD || !enemy.active) {
        this.formationSystem.onEnemyDeath(enemy);
        this.enemyCanDive.delete(enemy);
        this.enemyProfile.delete(enemy);
        this.enemyControllers.delete(enemy);
      }
    });
  }

  private onEnterRunState(state: RunState, from: RunState) {
    this.levelSystem.onEnterRunState(state, from);
    switch (state) {
      case RunState.READY:
        this.resetEntities();
        this.beginNewRunSession();
        this.playAgainBtn.setVisible(false);
        this.statusText.setText('Press space or tap to start');
        this.onReady?.();
        break;
      case RunState.COUNTDOWN:
        this.resetEntities();
        if (from === RunState.READY || from === RunState.RESULTS) {
          this.beginNewRunSession();
        }
        if (from === RunState.PLAYER_RESPAWN) {
          this.lifeSystem.startRespawnInvulnerability();
        }
        void this.ensureRunStarted();
        break;
      case RunState.PLAYING:
        this.statusText.setText(
          `Run live - ${this.lifeSystem.lives} lives left`,
        );
        break;
      case RunState.PLAYER_RESPAWN:
        this.resetEntities();
        this.playerBody.enable = false;
        this.player.setVisible(false);
        this.statusText.setText(
          `Respawning (${this.lifeSystem.lives} lives left)`,
        );
        break;
      case RunState.WAVE_CLEAR:
        this.resetEntities();
        if (!this.levelSystem.hasNextWave()) {
          this.statusText.setText('All waves cleared');
          break;
        }
        this.statusText.setText('Wave clear');
        break;
      case RunState.LEVEL_COMPLETE:
        this.resetEntities();
        this.statusText.setText(
          `Level ${this.levelSystem.getLevelNumber()} clear`,
        );
        break;
      case RunState.RUN_ENDING:
        this.scoreSystem.finalizeRun(this.simNowMs);
        this.syncScoreFromSystem();
        this.statusText.setText('Run over');
        break;
      case RunState.RESULTS:
        this.scoreSystem.finalizeRun(this.simNowMs);
        this.syncScoreFromSystem();
        this.playAgainBtn.setVisible(true);
        void this.submitScoreIfNeeded();
        break;
      case RunState.ERROR:
        this.statusText.setText('Runtime error');
        break;
      default:
        break;
    }
  }

  private restartGame() {
    if (this.submitting) return;
    this.resetEntities();
    this.playAgainBtn.setVisible(false);
    this.startRequested = false;
    this.runStateMachine.requestStart();
  }

  destroyResources() {
    this.formationSystem.clear();
    this.weaponSystem.clear();
    this.enemyWeaponSystem.clear();
    this.diveScheduler = undefined;
    this.enemyCanDive.clear();
    this.enemyProfile.clear();
    this.sound?.stopAll();
    this.sound?.removeAll();
    this.scoreSystem.dispose();
    this.runStateMachine.dispose();
    this.runBus.clear();
    this.disposables.disposeAll();
  }

  private syncScoreFromSystem(): void {
    this.score = this.scoreSystem.getState().score;
    this.scoreText.setText(`Score: ${this.score}`);
  }
}

export type SpaceBlasterMountHandle = {
  unmount: () => void;
  destroy: () => void;
  getDiagnostics: () => {
    disposed: boolean;
    activeCanvasCount: number;
    activeDisposables: number;
  };
};

const createGameInstance = (opts: MountOptions, el: HTMLElement) => {
  const scene = new SpaceBlasterScene(opts);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    parent: el,
    backgroundColor: '#0b0d13',
    physics: {
      default: 'arcade',
      arcade: {
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [scene],
  });

  let disposed = false;
  const teardown = () => {
    if (disposed) return;
    disposed = true;
    try {
      scene.destroyResources();
    } catch {
      // Continue teardown even if resource cleanup throws.
    }
    game.destroy(true);
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  };

  return {
    unmount: () => {
      teardown();
    },
    destroy: () => {
      teardown();
    },
    getDiagnostics: () => ({
      disposed,
      activeCanvasCount: el.querySelectorAll('canvas').length,
      activeDisposables: opts.disposables.size(),
    }),
  };
};

export type SpaceBlasterMountInput = {
  sdk: EmbeddedGameSdk;
  resolvedConfig: ResolvedGameConfigV1;
  onReady?: () => void;
  onGameOver?: (finalScore: number) => void;
};

export const mount = (
  container: HTMLElement,
  input: SpaceBlasterMountInput,
): SpaceBlasterMountHandle => {
  if (!container) {
    throw new Error('Missing mount container for Space Blaster.');
  }
  if (!input.resolvedConfig) {
    throw new Error('Missing resolvedConfig for Space Blaster mount.');
  }
  const runContext = createRunContext({
    sdk: input.sdk,
    resolvedConfig: input.resolvedConfig,
  });
  const deps = createBootstrapDependencies(runContext);
  const disposables = new DisposableBag();
  return createGameInstance(
    {
      deps,
      onReady: input.onReady,
      onGameOver: input.onGameOver,
      disposables,
    },
    container,
  );
};

export const unmount = (handle: SpaceBlasterMountHandle | null | undefined) => {
  handle?.unmount();
};

// Public mount contract: pass a container element via `el` and keep `resolvedConfig`
// stable for the full mounted run; call `destroy()` to unmount.
export const spaceBlaster: EmbeddedGame = {
  mount({ el, sdk, resolvedConfig, onReady, onGameOver }) {
    const instance = mount(el, {
      sdk: sdk as EmbeddedGameSdk,
      resolvedConfig: resolvedConfig as ResolvedGameConfigV1,
      onReady,
      onGameOver,
    });
    return {
      destroy() {
        instance.unmount();
      },
    };
  },
};
