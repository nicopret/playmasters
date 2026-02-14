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
  canPlayerFire,
  isSimulationRunning,
  type PlayerRunPhase,
} from './systems/player-action-gates';
import { PlayerController } from './systems/PlayerController';
import { PlayerLifeSystem } from './systems/PlayerLifeSystem';
import { WeaponSystem } from './systems/WeaponSystem';

type MountOptions = {
  deps: SpaceBlasterBootstrapDeps;
  onReady?: () => void;
  onGameOver?: (finalScore: number) => void;
  disposables: DisposableBag;
};

type GameState = PlayerRunPhase;

const GAME_ID = 'game-space-blaster';
const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 450;
const DEFAULT_RESPAWN_INVULNERABILITY_MS = 1200;
const RESPAWN_DELAY_MS = 700;

class SpaceBlasterScene extends Phaser.Scene {
  private deps: SpaceBlasterBootstrapDeps;
  private onReady?: () => void;
  private onGameOver?: (score: number) => void;
  private disposables: DisposableBag;

  private player!: Phaser.GameObjects.Rectangle;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private playerController!: PlayerController;
  private lifeSystem!: PlayerLifeSystem;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private weaponSystem!: WeaponSystem;
  private enemies!: Phaser.Physics.Arcade.Group;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private respawnTimer?: Phaser.Time.TimerEvent;

  private score = 0;
  private startTime: number | null = null;
  private state: GameState = 'idle';
  private canSubmitScore = true;
  private submitting = false;

  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private playAgainBtn!: Phaser.GameObjects.Text;

  private keyboardSpaceHandler?: () => void;
  private pointerDownHandler?: () => void;

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
    const moveSpeed =
      this.deps.heroCatalog.entries[0]?.moveSpeed &&
      this.deps.heroCatalog.entries[0].moveSpeed > 0
        ? this.deps.heroCatalog.entries[0].moveSpeed
        : 380;
    const heroEntry = this.deps.heroCatalog.entries[0];
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
    this.enemies = this.physics.add.group({ runChildUpdate: true });

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

    this.physics.add.overlap(
      this.weaponSystem.projectileGroup,
      this.enemies,
      (bullet, enemy) => {
        this.weaponSystem.releaseProjectile(
          bullet as Phaser.GameObjects.Rectangle,
        );
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

    this.setState('idle');
    this.onReady?.();
  }

  override update(_time: number, delta: number) {
    if (isSimulationRunning(this.state)) {
      this.lifeSystem.update(delta);
      const inputAxis = this.cursors.left?.isDown
        ? -1
        : this.cursors.right?.isDown
          ? 1
          : 0;
      this.playerController.update(delta, inputAxis);

      if (this.cursors.space?.isDown) {
        this.fireManualShot();
      }

      this.enemies.children.each((enemy) => {
        const e = enemy as Phaser.GameObjects.Rectangle;
        if (e.y > WORLD_HEIGHT - 12) {
          this.finishRun('ENEMY_REACHED_BOTTOM');
        }
        return false;
      });
      this.weaponSystem.update(delta);
    }

    if (this.lifeSystem.invulnerable) {
      const flashVisible = Math.floor(_time / 80) % 2 === 0;
      this.player.setAlpha(flashVisible ? 0.5 : 1);
      return;
    }
    this.player.setAlpha(1);
  }

  private handleSpace() {
    if (this.state === 'idle') {
      this.startGame();
      return;
    }
    if (this.state === 'gameover') {
      this.restartGame();
      return;
    }
    this.fireManualShot();
  }

  private async startGame() {
    if (this.state === 'playing') return;

    this.resetEntities();
    this.setState('playing');
    this.score = 0;
    this.startTime = Date.now();
    this.scoreText.setText('Score: 0');
    this.lifeSystem.reset();
    this.updateLivesDisplay();
    this.statusText.setText('Starting run...');
    this.playAgainBtn.setVisible(false);
    this.canSubmitScore = true;

    try {
      await this.deps.sdk.startRun();
      this.statusText.setText('Run live - survive and score!');
    } catch {
      this.canSubmitScore = false;
      this.statusText.setText('Sign in to submit score');
    }

    this.spawnTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.spawnEnemy(),
    });
  }

  private resetEntities() {
    this.enemies.clear(true, true);
    this.weaponSystem.clear();
    this.respawnTimer?.destroy();
    this.respawnTimer = undefined;
    this.player.setPosition(WORLD_WIDTH / 2, WORLD_HEIGHT - 60);
    this.playerController.resetPosition(WORLD_WIDTH / 2);
    this.playerBody.setVelocity(0);
    this.playerBody.enable = true;
    this.player.setVisible(true);
    this.player.setAlpha(1);
  }

  private fireManualShot() {
    if (!canPlayerFire(this.state, this.lifeSystem.invulnerable)) return;
    this.weaponSystem.tryFire(this.player.x, this.player.y - 20, -1);
  }

  private spawnEnemy() {
    if (this.state !== 'playing') return;
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

  private updateLivesDisplay() {
    this.livesText.setText(`Lives: ${this.lifeSystem.lives}`);
  }

  private handlePlayerHit() {
    if (this.state !== 'playing') return;
    const hitResult = this.lifeSystem.onPlayerHit();
    if (hitResult.kind === 'ignored') {
      return;
    }

    this.updateLivesDisplay();
    if (hitResult.kind === 'end_run') {
      void this.finishRun('GAME_OVER');
      return;
    }

    this.startRespawnSequence();
  }

  private startRespawnSequence() {
    this.setState('player_respawn');
    this.playerBody.setVelocity(0);
    this.playerBody.enable = false;
    this.player.setVisible(false);
    this.statusText.setText('Respawning...');
    this.respawnTimer?.destroy();
    this.respawnTimer = this.time.delayedCall(RESPAWN_DELAY_MS, () => {
      this.player.setPosition(WORLD_WIDTH / 2, WORLD_HEIGHT - 60);
      this.playerController.resetPosition(WORLD_WIDTH / 2);
      this.playerBody.enable = true;
      this.player.setVisible(true);
      this.setState('playing');
      this.statusText.setText('Run live - survive and score!');
    });
  }

  private async finishRun(reason: 'GAME_OVER' | 'ENEMY_REACHED_BOTTOM') {
    if (this.state !== 'playing') return;
    this.setState('run_ending');

    this.spawnTimer?.destroy();
    this.spawnTimer = undefined;
    this.respawnTimer?.destroy();
    this.respawnTimer = undefined;

    this.enemies.setVelocityY(0);
    this.enemies.children.each((enemy) => {
      const body = (enemy as Phaser.GameObjects.Rectangle)
        .body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0);
      return false;
    });

    this.statusText.setText(reason === 'GAME_OVER' ? 'Game over' : 'Run over');
    this.playAgainBtn.setVisible(true);

    if (!this.canSubmitScore || this.submitting) {
      this.setState('gameover');
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
      this.setState('gameover');
      this.onGameOver?.(this.score);
    }
  }

  private restartGame() {
    if (this.submitting) return;
    this.setState('idle');
    this.statusText.setText('Press space or tap to start');
    this.playAgainBtn.setVisible(false);
    this.lifeSystem.reset();
    this.updateLivesDisplay();
    this.resetEntities();
  }

  private setState(nextState: GameState) {
    this.state = nextState;
    this.physics.world.isPaused = nextState !== 'playing';
  }

  destroyResources() {
    this.spawnTimer?.destroy();
    this.spawnTimer = undefined;
    this.respawnTimer?.destroy();
    this.respawnTimer = undefined;
    this.enemies.clear(true, true);
    this.weaponSystem.clear();
    this.sound?.stopAll();
    this.sound?.removeAll();
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
