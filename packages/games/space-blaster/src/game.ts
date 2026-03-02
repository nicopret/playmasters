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
import {
  attemptRunSubmission,
  DisposableBag,
  OverlayCoordinator,
  createRunContext,
  isRunStartTransition,
  registerRunIfAuthenticated,
  resetRunRegistration,
} from './runtime';
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
import {
  buildFinalScoreSummary,
  type FinalScoreSummary,
  ScoreSystem,
} from './scoring';
import { buildResultsViewModel } from './results/buildResultsViewModel';
import { buildSubmitScorePayloadV1 } from './submit';
import { HUDSystem } from './ui/HUDSystem';
import { SettingsOverlay } from './ui/SettingsOverlay';
import { AudioSystem } from './audio/AudioSystem';
import { VfxSystem } from './vfx/VfxSystem';
import { PoolLimits } from './perf/poolLimits';
import { PoolMetricsOverlay } from './dev/PoolMetricsOverlay';
import {
  assertAtBaseline,
  captureBaseline,
  type PoolBaselineSnapshot,
  type PoolMetricsSnapshot,
} from './dev/poolLeakChecks';
import { OverlayState, OverlayStateMachine } from './overlay';

type MountOptions = {
  deps: SpaceBlasterBootstrapDeps;
  onReady?: () => void;
  onGameOver?: (finalScore: number) => void;
  disposables: DisposableBag;
};

const GAME_ID = 'game-space-blaster';
const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 450;
// Match the visual footprint used by the lightweight admin preview.
const ENEMY_WIDTH = 62;
const ENEMY_HEIGHT = 56;
const ENEMY_COLOR = 0xe94b5a;
const DEFAULT_RESPAWN_INVULNERABILITY_MS = 1200;
const COUNTDOWN_MS = 1200;
const RESPAWN_DELAY_MS = 650;
const WAVE_CLEAR_MS = 750;
const LEVEL_COMPLETE_MS = 900;
const RUN_ENDING_DELAY_MS = 900;
const SUBMITTING_TIMEOUT_MS = 7000;
const RUN_STATE_EVENT = 'playmasters:space-blaster-run-state';
const isRenderableTextureRef = (value: string | undefined): boolean => {
  if (!value) return false;
  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('/') ||
    value.startsWith('data:image/')
  );
};
const IS_DEV_RUNTIME = (() => {
  const globalWithProcess = globalThis as {
    process?: { env?: { NODE_ENV?: string } };
  };
  const isDev = globalWithProcess.process?.env?.NODE_ENV !== 'production';
  const debugOverlayEnabled =
    (globalWithProcess.process?.env as { ENABLE_POOL_DEBUG_OVERLAY?: string } | undefined)
      ?.ENABLE_POOL_DEBUG_OVERLAY === '1';
  return isDev && debugOverlayEnabled;
})();

class SpaceBlasterScene extends Phaser.Scene {
  private deps: SpaceBlasterBootstrapDeps;
  private onReady?: () => void;
  private onGameOver?: (score: number) => void;
  private disposables: DisposableBag;

  private player!: Phaser.GameObjects.Rectangle;
  private playerVisual?: Phaser.GameObjects.Image;
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
  private hudSystem!: HUDSystem;
  private settingsOverlay!: SettingsOverlay;
  private audioSystem!: AudioSystem;
  private vfxSystem!: VfxSystem;
  private poolMetricsOverlay?: PoolMetricsOverlay;
  private poolBaseline?: PoolBaselineSnapshot;
  private enemies!: Phaser.Physics.Arcade.Group;
  private enemyVisuals = new Map<
    Phaser.GameObjects.Rectangle,
    Phaser.GameObjects.Image
  >();
  private backdropVisual?: Phaser.GameObjects.Image;
  private textureKeyByAssetRef = new Map<string, string>();
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
  private submitting = false;
  private runStarted = false;
  private startRequested = false;
  private simNowMs = 0;
  private wavesCleared = 0;
  private maxLevelReached = 1;
  private maxWaveReached = 1;
  private finalSummary: FinalScoreSummary | null = null;
  private overlayRestartPending = false;

  private statusText!: Phaser.GameObjects.Text;
  private resultsText!: Phaser.GameObjects.Text;
  private playAgainBtn!: Phaser.GameObjects.Text;

  private keyboardSpaceHandler?: () => void;
  private keyboardEscHandler?: () => void;
  private pointerDownHandler?: () => void;
  private visibilityChangeHandler?: () => void;
  private blurHandler?: () => void;
  private focusHandler?: () => void;
  private overlayBlockingGameplay = false;
  private readonly overlayStateMachine = new OverlayStateMachine();
  private overlayCoordinator!: OverlayCoordinator;
  private visibilityBlocked = false;
  private runBus = new RunEventBus();
  private runStateMachine = new RunStateMachine(
    this.runBus,
    {
      countdownMs: COUNTDOWN_MS,
      respawnDelayMs: RESPAWN_DELAY_MS,
      waveClearMs: WAVE_CLEAR_MS,
      levelCompleteMs: LEVEL_COMPLETE_MS,
      runEndingDelayMs: RUN_ENDING_DELAY_MS,
      submittingTimeoutMs: SUBMITTING_TIMEOUT_MS,
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

  preload() {
    this.load.setCORS('anonymous');

    const register = (assetRef: string | undefined) => {
      if (!isRenderableTextureRef(assetRef)) return;
      if (!assetRef) return;
      if (this.textureKeyByAssetRef.has(assetRef)) return;
      const key = `asset-${this.textureKeyByAssetRef.size + 1}`;
      this.textureKeyByAssetRef.set(assetRef, key);
      this.load.image(key, assetRef);
    };

    const firstLevel = this.deps.levelConfigs[0] as ResolvedLevelConfigV1 & {
      backgroundUrl?: string;
    };
    register(firstLevel?.backgroundUrl);

    const heroEntry = this.deps.heroCatalog.entries[0];
    register(heroEntry?.spriteUrl ?? heroEntry?.spriteKey);

    this.deps.enemyCatalog.entries.forEach((enemy) => {
      register(enemy.spriteUrl ?? enemy.spriteKey);
    });

    this.deps.ammoCatalog.entries.forEach((ammo) => {
      register(ammo.spriteUrl ?? ammo.spriteKey);
    });
  }

  create() {
    this.cameras.main.setBackgroundColor('#0f111a');
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    const levelConfig = (this.deps.levelConfigs[0] ?? {}) as ResolvedLevelConfigV1 & {
      backgroundUrl?: string;
    };

    const backdrop = this.add.rectangle(
      WORLD_WIDTH / 2,
      WORLD_HEIGHT / 2,
      WORLD_WIDTH,
      WORLD_HEIGHT,
      0x101628,
    );
    const backgroundTextureKey = this.getTextureKeyForAssetRef(
      levelConfig.backgroundUrl,
    );
    if (backgroundTextureKey) {
      this.backdropVisual = this.add
        .image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, backgroundTextureKey)
        .setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT)
        .setDepth(-20);
    }
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
    const playerTextureKey = this.getTextureKeyForAssetRef(
      heroEntry?.spriteUrl ?? heroEntry?.spriteKey,
    );
    if (playerTextureKey) {
      this.playerVisual = this.add
        .image(this.player.x, this.player.y, playerTextureKey)
        .setDisplaySize(this.player.width, this.player.height)
        .setDepth(8);
      this.player.setFillStyle(0x3aa9e0, 0.01);
    }
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
        poolInitialSize: PoolLimits.playerBullets.initial,
        poolMaxSize: PoolLimits.playerBullets.max,
      },
    );
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
        poolInitialSize: PoolLimits.enemyBullets.initial,
        poolMaxSize: PoolLimits.enemyBullets.max,
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
          body.setCircle(Math.floor(Math.min(ENEMY_WIDTH, ENEMY_HEIGHT) * 0.3));
          const enemyTextureKey = this.getTextureKeyForAssetRef(
            enemyEntry?.spriteUrl ?? enemyEntry?.spriteKey,
          );
          if (enemyTextureKey) {
            const visual = this.add
              .image(x, y, enemyTextureKey)
              .setDisplaySize(ENEMY_WIDTH, ENEMY_HEIGHT)
              .setDepth(7);
            this.enemyVisuals.set(enemy, visual);
            enemy.setFillStyle(ENEMY_COLOR, 0.01);
          }
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
          this.enemyVisuals.forEach((visual) => visual.destroy());
          this.enemyVisuals.clear();
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
    this.hudSystem = new HUDSystem({
      scene: this,
      ctx: this.deps.ctx,
      bus: this.runBus,
      scoreSystem: this.scoreSystem,
      getLives: () => this.lifeSystem.lives,
    });
    this.hudSystem.create();
    this.audioSystem = new AudioSystem({
      scene: this,
      ctx: this.deps.ctx,
      bus: this.runBus,
    });
    this.settingsOverlay = new SettingsOverlay({
      scene: this,
      getMusicVolume: () => this.audioSystem.getMusicVolume(),
      getSfxVolume: () => this.audioSystem.getSfxVolume(),
      onMusicVolumeChanged: (value) => this.audioSystem.setMusicVolume(value),
      onSfxVolumeChanged: (value) => this.audioSystem.setSfxVolume(value),
      onResumeRequested: () => this.overlayCoordinator.requestResume(),
      onSettingsRequested: () => this.overlayCoordinator.requestOpenSettings(),
      onBackFromSettingsRequested: () =>
        this.overlayCoordinator.requestCloseSettings(),
      onRestartRequested: () => this.overlayCoordinator.requestRestart(),
    });
    this.settingsOverlay.create();
    this.overlayCoordinator = new OverlayCoordinator({
      overlay: this.overlayStateMachine,
      onOverlayChanged: (state) => this.onOverlayStateChanged(state),
      onRestartRequested: () => this.handleOverlayRestartRequested(),
    });
    this.vfxSystem = new VfxSystem({
      scene: this,
      ctx: this.deps.ctx,
      bus: this.runBus,
      explosionPoolSize: PoolLimits.explosions.initial,
      explosionPoolMax: PoolLimits.explosions.max,
      particlePoolSize: PoolLimits.particles.initial,
      particlePoolMax: PoolLimits.particles.max,
    });
    if (IS_DEV_RUNTIME) {
      this.poolBaseline = captureBaseline(this.getPoolMetricsSnapshot());
      this.poolMetricsOverlay = new PoolMetricsOverlay({
        scene: this,
        getMetrics: () => this.getPoolMetricsSnapshot(),
      });
    }
    this.audioSystem.start();
    this.runBus.emit(RUN_EVENT.PLAYER_LIVES_CHANGED, {
      livesRemaining: this.lifeSystem.lives,
      nowMs: this.simNowMs,
    });
    this.disposables.add(
      this.runBus.on(RUN_EVENT.LEVEL_WAVE_CLEARED, () => {
        this.wavesCleared += 1;
        this.syncReachedProgress();
        this.syncScoreFromSystem();
      }),
    );

    this.statusText = this.add.text(16, 58, 'Press space or tap to start', {
      fontFamily: 'Montserrat, Arial, sans-serif',
      fontSize: '14px',
      color: '#d5d8e0',
    });

    this.resultsText = this.add
      .text(WORLD_WIDTH - 16, 88, '', {
        fontFamily: 'Montserrat, Arial, sans-serif',
        fontSize: '14px',
        color: '#d5d8e0',
        align: 'right',
      })
      .setOrigin(1, 0)
      .setVisible(false);

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
    this.keyboardEscHandler = () => this.handleEscape();
    this.pointerDownHandler = () => this.handleSpace();
    keyboard.on('keydown-SPACE', this.keyboardSpaceHandler);
    keyboard.on('keydown-ESC', this.keyboardEscHandler);
    this.input.on('pointerdown', this.pointerDownHandler);

    this.disposables.add(() => {
      if (this.keyboardSpaceHandler) {
        keyboard.off('keydown-SPACE', this.keyboardSpaceHandler);
      }
      if (this.keyboardEscHandler) {
        keyboard.off('keydown-ESC', this.keyboardEscHandler);
      }
      if (this.pointerDownHandler) {
        this.input.off('pointerdown', this.pointerDownHandler);
      }
    });

    if (typeof document !== 'undefined') {
      this.visibilityBlocked = document.hidden;
      this.syncOverlayBlockingGameplay();
      this.visibilityChangeHandler = () => {
        this.visibilityBlocked = document.hidden;
        this.syncOverlayBlockingGameplay();
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
        this.visibilityBlocked = true;
        this.syncOverlayBlockingGameplay();
      };
      this.focusHandler = () => {
        this.visibilityBlocked = false;
        this.syncOverlayBlockingGameplay();
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
        const killX = target.x;
        const killY = target.y;
        const visual = this.enemyVisuals.get(target);
        if (visual) {
          visual.destroy();
          this.enemyVisuals.delete(target);
        }
        target.destroy();
        if (enemyId) {
          this.runBus.emit(RUN_EVENT.ENEMY_KILLED, {
            enemyId,
            nowMs: this.simNowMs,
            x: killX,
            y: killY,
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
        if (this.playerVisual) {
          this.playerVisual.setPosition(this.player.x, this.player.y);
        }
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
        this.syncReachedProgress();
        this.syncEnemyVisuals();

        this.weaponSystem.update(dtMs);
        this.enemyWeaponSystem.update(dtMs);
      },
    });
    this.hudSystem.update(this.simNowMs);
    this.audioSystem.setPauseOverlayActive(this.overlayBlockingGameplay);
    this.vfxSystem.update(this.simNowMs);
    this.poolMetricsOverlay?.update(this.simNowMs);

    if (this.lifeSystem.invulnerable) {
      const flashVisible = Math.floor(_time / 80) % 2 === 0;
      this.player.setAlpha(flashVisible ? 0.5 : 1);
      if (this.playerVisual) {
        this.playerVisual.setAlpha(flashVisible ? 0.5 : 1);
      }
      return;
    }
    this.player.setAlpha(1);
    if (this.playerVisual) {
      this.playerVisual.setAlpha(1);
    }
  }

  private getTextureKeyForAssetRef(
    assetRef: string | undefined,
  ): string | undefined {
    if (!assetRef) return undefined;
    const textureKey = this.textureKeyByAssetRef.get(assetRef);
    if (!textureKey) return undefined;
    if (!this.textures.exists(textureKey)) return undefined;
    return textureKey;
  }

  private syncEnemyVisuals(): void {
    this.enemyVisuals.forEach((visual, enemy) => {
      if (!enemy.active) {
        visual.destroy();
        this.enemyVisuals.delete(enemy);
        return;
      }
      visual.setPosition(enemy.x, enemy.y);
      visual.setVisible(enemy.visible);
      visual.setAlpha(enemy.alpha);
    });
  }

  private handleSpace() {
    if (this.overlayBlockingGameplay) {
      return;
    }
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

  private handleEscape() {
    if (this.overlayStateMachine.getState() === OverlayState.SETTINGS) {
      this.overlayCoordinator.requestCloseSettings();
      return;
    }

    if (this.overlayStateMachine.getState() === OverlayState.PAUSED) {
      this.overlayCoordinator.requestResume();
      return;
    }

    if (this.runStateMachine.state === RunState.PLAYING) {
      this.overlayCoordinator.requestPause();
    }
  }

  private syncOverlayBlockingGameplay(): void {
    this.overlayBlockingGameplay =
      this.overlayStateMachine.getBlocksGameplay() || this.visibilityBlocked;
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
    if (this.playerVisual) {
      this.playerVisual.setPosition(this.player.x, this.player.y);
    }
    this.playerController.resetPosition(WORLD_WIDTH / 2);
    this.playerBody.setVelocity(0);
    this.playerBody.enable = true;
    this.player.setVisible(true);
    if (this.playerVisual) {
      this.playerVisual.setVisible(true);
    }
    this.player.setAlpha(1);
    if (this.playerVisual) {
      this.playerVisual.setAlpha(1);
    }
  }

  private fireManualShot() {
    if (this.runStateMachine.state !== RunState.PLAYING) return;
    if (this.overlayBlockingGameplay) return;
    if (this.lifeSystem.invulnerable) return;
    const fired = this.weaponSystem.tryFire(
      this.player.x,
      this.player.y - 20,
      -1,
    );
    if (!fired) return;
    this.runBus.emit(RUN_EVENT.PLAYER_SHOT_FIRED, { nowMs: this.simNowMs });
  }

  private handlePlayerHit() {
    if (this.runStateMachine.state !== RunState.PLAYING) return;

    const hitResult = this.lifeSystem.onPlayerHit();
    if (hitResult.kind === 'ignored') {
      return;
    }
    this.runBus.emit(RUN_EVENT.PLAYER_HIT, { nowMs: this.simNowMs });
    this.runBus.emit(RUN_EVENT.PLAYER_LIVES_CHANGED, {
      livesRemaining: hitResult.livesRemaining,
      nowMs: this.simNowMs,
    });
    if (hitResult.kind === 'end_run') {
      this.runStateMachine.requestEndRun('player_death');
      return;
    }

    this.runStateMachine.requestRespawn();
  }

  private async submitScoreInSubmitting() {
    if (this.submitting) return;
    const summary = this.getOrBuildFinalSummary();
    this.submitting = true;

    try {
      const payload = buildSubmitScorePayloadV1({
        finalScore: summary,
        run: this.deps.ctx,
        levelProgress: {
          levelNumber: this.maxLevelReached,
          waveIndex: Math.max(0, this.maxWaveReached - 1),
          wavesCleared: this.wavesCleared,
        },
      });
      const result = await attemptRunSubmission({
        ctx: this.deps.ctx,
        payload,
        nowMs: this.simNowMs,
      });
      if (result === 'success') {
        window.dispatchEvent(
          new CustomEvent('playmasters:refresh-leaderboard', {
            detail: { gameId: GAME_ID },
          }),
        );
      }
    } catch (error) {
      this.deps.ctx.submissionStatus = {
        state: 'fail',
        errorMessage:
          error instanceof Error ? error.message : 'Submission failed.',
      };
    } finally {
      this.submitting = false;
      this.syncSubmissionStatusText();
      this.runStateMachine.requestSubmissionComplete();
    }
  }

  private beginNewRunSession() {
    this.runStarted = false;
    this.startRequested = false;
    this.score = 0;
    this.simNowMs = 0;
    this.wavesCleared = 0;
    this.maxLevelReached = 1;
    this.maxWaveReached = 1;
    this.finalSummary = null;
    this.submitting = false;
    this.overlayRestartPending = false;
    this.hudSystem.clearTransientBanners();
    this.vfxSystem.resetAll();
    this.lifeSystem.reset();
    this.runBus.emit(RUN_EVENT.PLAYER_LIVES_CHANGED, {
      livesRemaining: this.lifeSystem.lives,
      nowMs: this.simNowMs,
    });
    this.levelSystem.startLevel(0);
    resetRunRegistration(this.deps.ctx);
    this.scoreSystem.resetForNewRun();
    this.syncScoreFromSystem();
    this.checkPoolBaselineIfDev();
  }

  private async ensureRunStarted() {
    if (this.runStarted) return;
    this.runStarted = true;
    try {
      const registration = await registerRunIfAuthenticated(this.deps.ctx);
      if (registration === 'started') {
        return;
      }
      if (registration === 'skipped_unauthenticated') {
        return;
      }
      this.statusText.setText('Sign in to submit score');
    } catch (error) {
      this.statusText.setText((error as Error).message);
      this.runStateMachine.requestEndRun('run_start_failed');
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
    const telegraphLeadMs = Math.max(
      0,
      Math.floor(
        (level?.diveScheduler as { telegraphLeadMs?: number } | undefined)
          ?.telegraphLeadMs ?? 300,
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
        telegraphLeadMs,
      },
      getCandidates: () => {
        const candidates: Array<{
          enemy: Phaser.GameObjects.Rectangle;
          enemyId?: string;
          active: boolean;
          canDive: boolean;
          controller: EnemyController;
        }> = [];
        this.enemyControllers.forEach((controller, enemy) => {
          const profile = this.enemyProfile.get(enemy);
          candidates.push({
            enemy,
            enemyId: profile?.enemyId,
            active: enemy.active,
            canDive: this.enemyCanDive.get(enemy) ?? true,
            controller,
          });
        });
        return candidates;
      },
      onDiveTelegraph: ({ enemyId, leadMs }) => {
        this.runBus.emit(RUN_EVENT.ENEMY_DIVE_TELEGRAPH, {
          enemyId,
          nowMs: this.simNowMs,
          leadMs,
        });
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
    this.dispatchRunStateEvent(state);
    this.overlayCoordinator.syncFromRunState(state);
    this.levelSystem.onEnterRunState(state, from);
    switch (state) {
      case RunState.READY:
        this.resetEntities();
        this.beginNewRunSession();
        this.renderReadyPreviewFormation();
        this.playAgainBtn.setVisible(false);
        this.resultsText.setVisible(false);
        this.statusText.setText('Press space or tap to start');
        this.onReady?.();
        break;
      case RunState.COUNTDOWN:
        this.resetEntities();
        this.resultsText.setVisible(false);
        if (from === RunState.READY || from === RunState.RESULTS) {
          this.beginNewRunSession();
        }
        if (from === RunState.PLAYER_RESPAWN) {
          this.lifeSystem.startRespawnInvulnerability();
        }
        if (isRunStartTransition(from, state)) {
          void this.ensureRunStarted();
        }
        break;
      case RunState.PLAYING:
        this.resultsText.setVisible(false);
        this.statusText.setText(
          `Run live - ${this.lifeSystem.lives} lives left`,
        );
        break;
      case RunState.PLAYER_RESPAWN:
        this.resetEntities();
        this.playerBody.enable = false;
        this.player.setVisible(false);
        if (this.playerVisual) {
          this.playerVisual.setVisible(false);
        }
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
        this.finalSummary = this.buildFinalSummary();
        this.syncScoreFromSystem();
        this.statusText.setText('Run over');
        break;
      case RunState.SUBMITTING:
        this.resultsText.setVisible(false);
        this.statusText.setText('Submitting score...');
        void this.submitScoreInSubmitting();
        break;
      case RunState.RESULTS:
        this.scoreSystem.finalizeRun(this.simNowMs);
        this.finalSummary = this.getOrBuildFinalSummary();
        this.syncScoreFromSystem();
        this.playAgainBtn.setVisible(true);
        this.syncSubmissionStatusText();
        this.onGameOver?.(this.score);
        if (this.overlayRestartPending) {
          this.overlayRestartPending = false;
          this.handleOverlayRestartRequested();
        }
        break;
      case RunState.ERROR:
        this.statusText.setText('Runtime error');
        break;
      default:
        break;
    }
  }

  private restartGame() {
    this.overlayCoordinator.requestRestart();
  }

  private handleOverlayRestartRequested(): void {
    if (this.submitting) return;
    if (this.runStateMachine.state === RunState.PLAYING) {
      this.overlayRestartPending = true;
      this.runStateMachine.requestEndRun('overlay_restart_requested');
      return;
    }
    if (this.runStateMachine.state !== RunState.RESULTS) {
      return;
    }
    this.resetEntities();
    this.playAgainBtn.setVisible(false);
    this.startRequested = false;
    this.runStateMachine.requestStart();
  }

  private dispatchRunStateEvent(state: RunState): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.dispatchEvent(
      new CustomEvent(RUN_STATE_EVENT, {
        detail: { gameId: GAME_ID, state },
      }),
    );
  }

  private onOverlayStateChanged(state: OverlayState): void {
    switch (state) {
      case OverlayState.NONE:
      case OverlayState.RESULTS:
        this.settingsOverlay.hideAll();
        break;
      case OverlayState.PAUSED:
        this.settingsOverlay.showPauseMenu();
        break;
      case OverlayState.SETTINGS:
        this.settingsOverlay.showSettings();
        break;
      default:
        break;
    }
    this.syncOverlayBlockingGameplay();
  }

  destroyResources() {
    this.formationSystem.clear();
    this.weaponSystem.clear();
    this.enemyWeaponSystem.clear();
    this.settingsOverlay.destroy();
    this.hudSystem.destroy();
    this.audioSystem.stop();
    this.vfxSystem.destroy();
    this.poolMetricsOverlay?.destroy();
    this.poolMetricsOverlay = undefined;
    this.diveScheduler = undefined;
    this.enemyCanDive.clear();
    this.enemyProfile.clear();
    this.enemyVisuals.forEach((visual) => visual.destroy());
    this.enemyVisuals.clear();
    this.playerVisual?.destroy();
    this.playerVisual = undefined;
    this.backdropVisual?.destroy();
    this.backdropVisual = undefined;
    this.sound?.stopAll();
    this.sound?.removeAll();
    this.scoreSystem.dispose();
    this.runStateMachine.dispose();
    this.runBus.clear();
    this.disposables.disposeAll();
  }

  private syncScoreFromSystem(): void {
    this.score = this.scoreSystem.getState().score;
  }

  private buildFinalSummary(): FinalScoreSummary {
    return buildFinalScoreSummary({
      scoreState: this.scoreSystem.getState(),
      durationMs: this.simNowMs,
      levelReached: this.maxLevelReached,
      waveReached: this.maxWaveReached,
      wavesCleared: this.wavesCleared,
    });
  }

  private getOrBuildFinalSummary(): FinalScoreSummary {
    if (!this.finalSummary) {
      this.finalSummary = this.buildFinalSummary();
    }
    return this.finalSummary;
  }

  private syncReachedProgress(): void {
    const levelReached = this.levelSystem.getLevelNumber();
    const waveReached = this.levelSystem.getWaveIndex() + 1;
    if (levelReached > this.maxLevelReached) {
      this.maxLevelReached = levelReached;
    }
    if (waveReached > this.maxWaveReached) {
      this.maxWaveReached = waveReached;
    }
  }

  private syncSubmissionStatusText(): void {
    const status = this.deps.ctx.submissionStatus ?? { state: 'idle' as const };
    if (status.state === 'success') {
      this.statusText.setText('Score submitted');
      this.syncResultsOverlay();
      return;
    }
    if (status.state === 'submitting') {
      this.statusText.setText('Submitting score...');
      this.syncResultsOverlay();
      return;
    }
    if (status.state === 'skipped') {
      this.statusText.setText(
        status.reason === 'missingRunId'
          ? 'Not submitted (missing run id)'
          : 'Not submitted (not signed in)',
      );
      this.syncResultsOverlay();
      return;
    }
    if (status.state === 'fail') {
      this.statusText.setText(
        status.errorMessage
          ? `Submission failed: ${status.errorMessage}`
          : 'Submission failed',
      );
      this.syncResultsOverlay();
      return;
    }
    this.statusText.setText('Run finished');
    this.syncResultsOverlay();
  }

  private syncResultsOverlay(): void {
    if (this.runStateMachine.state !== RunState.RESULTS) {
      this.resultsText.setVisible(false);
      return;
    }

    const viewModel = buildResultsViewModel({
      finalScore: this.getOrBuildFinalSummary(),
      scoreState: this.scoreSystem.getState(),
      submissionStatus: this.deps.ctx.submissionStatus,
    });

    const lines = [
      `Final score: ${viewModel.finalScore}`,
      `Level reached: ${viewModel.levelReached}`,
      `Wave reached: ${viewModel.waveReached}`,
      `Accuracy: ${viewModel.accuracyPercent}%`,
      `Max combo: ${viewModel.maxCombo}`,
      `Wave bonuses: ${viewModel.waveBonuses}`,
      viewModel.submissionStatusLabel,
    ];
    if (viewModel.submissionStatusDetail) {
      lines.push(viewModel.submissionStatusDetail);
    }
    if (viewModel.rankLabel) {
      lines.push(viewModel.rankLabel);
    }
    if (viewModel.personalBestLabel) {
      lines.push(viewModel.personalBestLabel);
    }

    this.resultsText.setText(lines.join('\n'));
    this.resultsText.setVisible(true);
  }

  private getPoolMetricsSnapshot(): PoolMetricsSnapshot {
    const player = this.weaponSystem.getPoolStats();
    const enemy = this.enemyWeaponSystem.getPoolStats();
    const vfx = this.vfxSystem.getPoolStats();
    return {
      playerBullets: player,
      enemyBullets: enemy,
      explosions: vfx.explosions,
      particles: {
        inUse: vfx.particles.inUse,
        max: vfx.particles.maxBudget,
        activeBursts: vfx.particles.activeBursts,
      },
    };
  }

  private checkPoolBaselineIfDev(): void {
    if (!IS_DEV_RUNTIME || !this.poolBaseline) {
      return;
    }
    const report = assertAtBaseline(
      this.getPoolMetricsSnapshot(),
      this.poolBaseline,
    );
    this.poolMetricsOverlay?.setLeakReport(report);
  }

  private renderReadyPreviewFormation(): void {
    const level = this.deps.levelConfigs[0];
    const wave = level?.waves?.[0];
    if (!level || !wave) return;
    this.formationSystem.setLevelIndex?.(0);
    this.formationSystem.spawnFormation(wave);
    this.initializeEnemyControllers(level);
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
