import * as Phaser from 'phaser';
import type {
  EmbeddedGame,
  EmbeddedGameSdk,
  ResolvedGameConfigV1,
} from '@playmasters/types';
import {
  createBootstrapDependencies,
  type SpaceBlasterBootstrapDeps,
} from './bootstrap';
import { DisposableBag, createRunContext } from './runtime';
import {
  orchestrateRunFrame,
  RunEventBus,
  RunState,
  RunStateMachine,
} from './run';

type MountOptions = {
  deps: SpaceBlasterBootstrapDeps;
  onReady?: () => void;
  onGameOver?: (finalScore: number) => void;
  disposables: DisposableBag;
};

const GAME_ID = 'game-space-blaster';
const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 450;
const COUNTDOWN_MS = 1200;
const RESPAWN_DELAY_MS = 650;
const RUN_ENDING_DELAY_MS = 900;

class SpaceBlasterScene extends Phaser.Scene {
  private deps: SpaceBlasterBootstrapDeps;
  private onReady?: () => void;
  private onGameOver?: (score: number) => void;
  private disposables: DisposableBag;

  private player!: Phaser.GameObjects.Rectangle;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private autoFireTimer?: Phaser.Time.TimerEvent;

  private score = 0;
  private startTime: number | null = null;
  private remainingLives = 0;
  private canSubmitScore = true;
  private submitting = false;
  private runStarted = false;

  private scoreText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private playAgainBtn!: Phaser.GameObjects.Text;

  private lastManualShotAt = 0;
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
    this.playerBody.setDragX(650);

    this.bullets = this.physics.add.group({ runChildUpdate: true });
    this.enemies = this.physics.add.group({ runChildUpdate: true });

    this.scoreText = this.add.text(16, 12, 'Score: 0', {
      fontFamily: 'Montserrat, Arial, sans-serif',
      fontSize: '18px',
      color: '#f9d65c',
    });

    this.statusText = this.add.text(16, 40, 'Press space or tap to start', {
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
        if (this.blurHandler)
          window.removeEventListener('blur', this.blurHandler);
        if (this.focusHandler) {
          window.removeEventListener('focus', this.focusHandler);
        }
      });
    }

    this.physics.add.overlap(
      this.bullets,
      this.enemies,
      (bullet, enemy) => {
        bullet.destroy();
        enemy.destroy();
        this.addScore(10);
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
      advanceSimulation: () => {
        const velocity = 380;
        if (this.cursors.left?.isDown) {
          this.playerBody.setVelocityX(-velocity);
        } else if (this.cursors.right?.isDown) {
          this.playerBody.setVelocityX(velocity);
        } else {
          this.playerBody.setVelocityX(0);
        }

        if (this.cursors.space?.isDown) {
          this.fireManualShot();
        }

        this.enemies.children.each((enemy) => {
          const e = enemy as Phaser.GameObjects.Rectangle;
          if (e.y > WORLD_HEIGHT - 12) {
            this.runStateMachine.requestEndRun('enemy_breach');
          }
          return false;
        });

        this.bullets.children.each((bullet) => {
          const b = bullet as Phaser.GameObjects.Rectangle;
          if (b.y < -20) b.destroy();
          return false;
        });
      },
    });
  }

  private handleSpace() {
    if (
      this.runStateMachine.state === RunState.READY ||
      this.runStateMachine.state === RunState.RUN_ENDED
    ) {
      this.runStateMachine.requestStart();
      return;
    }
    if (this.runStateMachine.state === RunState.PLAYING) this.fireManualShot();
  }

  private resetEntities() {
    this.enemies.clear(true, true);
    this.bullets.clear(true, true);
    this.player.setPosition(WORLD_WIDTH / 2, WORLD_HEIGHT - 60);
    this.playerBody.setVelocity(0);
  }

  private fireManualShot() {
    if (this.runStateMachine.state !== RunState.PLAYING) return;
    const now = Date.now();
    if (now - this.lastManualShotAt < 200) return;
    this.lastManualShotAt = now;
    this.fireBullet();
  }

  private fireBullet() {
    if (this.runStateMachine.state !== RunState.PLAYING) return;
    const bullet = this.add.rectangle(
      this.player.x,
      this.player.y - 20,
      6,
      16,
      0xf9d65c,
    );
    this.physics.add.existing(bullet);
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocityY(-560);
    body.setCircle(3);
    this.bullets.add(bullet);
  }

  private spawnEnemy() {
    if (this.runStateMachine.state !== RunState.PLAYING) return;
    const x = Phaser.Math.Between(30, WORLD_WIDTH - 30);
    const enemy = this.add.rectangle(x, -16, 34, 24, 0xe94b5a);
    this.physics.add.existing(enemy);
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocityY(Phaser.Math.Between(90, 160));
    body.setCircle(12);
    this.enemies.add(enemy);
  }

  private addScore(delta: number) {
    this.score += delta;
    this.scoreText.setText(`Score: ${this.score}`);
  }

  private stopActiveTimers() {
    this.spawnTimer?.destroy();
    this.autoFireTimer?.destroy();
    this.spawnTimer = undefined;
    this.autoFireTimer = undefined;
  }

  private freezeEnemies() {
    this.enemies.setVelocityY(0);
    this.enemies.children.each((enemy) => {
      const body = (enemy as Phaser.GameObjects.Rectangle)
        .body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0);
      return false;
    });
  }

  private handlePlayerHit() {
    if (this.runStateMachine.state !== RunState.PLAYING) return;
    this.remainingLives -= 1;
    if (this.remainingLives > 0) {
      this.runStateMachine.requestRespawn();
      return;
    }
    this.runStateMachine.requestEndRun('player_death');
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
    this.score = 0;
    this.remainingLives =
      this.deps.gameConfig.defaultLives && this.deps.gameConfig.defaultLives > 0
        ? this.deps.gameConfig.defaultLives
        : 3;
    this.startTime = null;
    this.scoreText.setText('Score: 0');
    this.canSubmitScore = true;
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

  private onEnterRunState(state: RunState, from: RunState) {
    switch (state) {
      case RunState.READY:
        this.resetEntities();
        this.beginNewRunSession();
        this.playAgainBtn.setVisible(false);
        this.statusText.setText('Press space or tap to start');
        this.onReady?.();
        break;
      case RunState.COUNTDOWN:
        this.stopActiveTimers();
        this.resetEntities();
        if (from === RunState.READY || from === RunState.RUN_ENDED) {
          this.beginNewRunSession();
        }
        void this.ensureRunStarted();
        break;
      case RunState.PLAYING:
        this.statusText.setText(`Run live - ${this.remainingLives} lives left`);
        this.spawnTimer = this.time.addEvent({
          delay: 1000,
          loop: true,
          callback: () => this.spawnEnemy(),
        });
        this.autoFireTimer = this.time.addEvent({
          delay: 480,
          loop: true,
          callback: () => this.fireBullet(),
        });
        break;
      case RunState.PLAYER_RESPAWN:
        this.stopActiveTimers();
        this.resetEntities();
        this.statusText.setText(
          `Respawning (${this.remainingLives} lives left)`,
        );
        break;
      case RunState.RUN_ENDING:
        this.stopActiveTimers();
        this.freezeEnemies();
        this.statusText.setText('Run over');
        break;
      case RunState.RUN_ENDED:
        this.playAgainBtn.setVisible(true);
        void this.submitScoreIfNeeded();
        break;
      case RunState.ERROR:
        this.stopActiveTimers();
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
    this.runStateMachine.requestStart();
  }

  destroyResources() {
    this.stopActiveTimers();
    this.enemies.clear(true, true);
    this.bullets.clear(true, true);
    this.sound?.stopAll();
    this.sound?.removeAll();
    this.runStateMachine.dispose();
    this.runBus.clear();
    this.disposables.disposeAll();
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
