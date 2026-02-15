import type * as Phaser from 'phaser';
import type { RunContext } from '../runtime';
import { RUN_EVENT, type RunEventBus } from '../run';
import type { ScoreSystem } from '../scoring';
import { BannerQueue } from './BannerQueue';

const DEFAULT_BANNER_HIDE_MS = 1500;
const SAFE_HUD_TOP_PADDING_PX = 8;
const SAFE_BANNER_Y_PX = 56;
const SAFE_LIVES_Y_PX = 34;
const SAFE_SCORE_Y_PX = 12;

type HUDSystemOptions = {
  scene: Phaser.Scene;
  ctx: RunContext;
  bus: RunEventBus;
  scoreSystem: ScoreSystem;
  getLives: () => number;
  bannerHideMs?: number;
};

export class HUDSystem {
  private readonly scene: HUDSystemOptions['scene'];
  private readonly bus: HUDSystemOptions['bus'];
  private readonly scoreSystem: HUDSystemOptions['scoreSystem'];
  private readonly getLives: HUDSystemOptions['getLives'];
  private readonly bannerHideMs: number;
  private readonly bannerQueue = new BannerQueue();

  private scoreText?: Phaser.GameObjects.Text;
  private livesText?: Phaser.GameObjects.Text;
  private bannerText?: Phaser.GameObjects.Text;
  private unsubscribers: Array<() => void> = [];

  private lastScore = Number.NaN;
  private lastLives = Number.NaN;
  private activeBannerMessage = '';

  constructor(options: HUDSystemOptions) {
    this.scene = options.scene;
    this.bus = options.bus;
    this.scoreSystem = options.scoreSystem;
    this.getLives = options.getLives;
    this.bannerHideMs = options.bannerHideMs ?? DEFAULT_BANNER_HIDE_MS;
  }

  create(): void {
    this.scoreText = this.scene.add.text(16, SAFE_SCORE_Y_PX, 'Score: 0', {
      fontFamily: 'Montserrat, Arial, sans-serif',
      fontSize: '18px',
      color: '#f9d65c',
    });
    this.livesText = this.scene.add.text(16, SAFE_LIVES_Y_PX, 'Lives: 0', {
      fontFamily: 'Montserrat, Arial, sans-serif',
      fontSize: '16px',
      color: '#d5d8e0',
    });

    const bannerX =
      typeof this.scene.scale?.width === 'number'
        ? this.scene.scale.width / 2
        : 400;
    this.bannerText = this.scene.add
      .text(bannerX, SAFE_BANNER_Y_PX + SAFE_HUD_TOP_PADDING_PX, '', {
        fontFamily: 'Montserrat, Arial, sans-serif',
        fontSize: '16px',
        color: '#7df9ff',
        backgroundColor: '#101628',
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.syncScore(this.scoreSystem.getState().score);
    this.syncLives(this.getLives());

    this.unsubscribers = [
      this.bus.on(RUN_EVENT.SCORE_CHANGED, ({ score }) => {
        this.syncScore(score);
      }),
      this.bus.on(RUN_EVENT.PLAYER_LIVES_CHANGED, ({ livesRemaining }) => {
        this.syncLives(livesRemaining);
      }),
      this.bus.on(RUN_EVENT.SCORE_TIER_ENTERED, (payload) => {
        this.bannerQueue.enqueue({
          kind: 'TIER',
          id: `tier:${payload.tierIndex}:${payload.comboCount}:${payload.nowMs}`,
          message: `Tier Up! Tier ${payload.tierIndex + 1} x${payload.multiplier.toFixed(2)}`,
          durationMs: this.bannerHideMs,
        });
      }),
      this.bus.on(RUN_EVENT.LEVEL_WAVE_CLEARED, (payload) => {
        this.bannerQueue.enqueue({
          kind: 'WAVE',
          id: `wave:${payload.levelNumber}:${payload.waveIndex}:${payload.nowMs}`,
          message: `Wave Clear!`,
          durationMs: this.bannerHideMs,
        });
      }),
      this.bus.on(RUN_EVENT.SCORE_COMBO_RESET, () => {
        const active = this.bannerQueue.getActive();
        if (active?.req.kind === 'TIER') {
          this.bannerQueue.dismissActive();
        }
      }),
    ];
  }

  update(simNowMs: number): void {
    this.bannerQueue.update(simNowMs);
    const active = this.bannerQueue.getActive();
    if (!active) {
      this.activeBannerMessage = '';
      this.bannerText?.setVisible(false);
      return;
    }
    if (active.req.message !== this.activeBannerMessage) {
      this.activeBannerMessage = active.req.message;
      this.bannerText?.setText(active.req.message);
    }
    this.bannerText?.setVisible(true);
  }

  clearTransientBanners(): void {
    this.bannerQueue.clear();
    this.activeBannerMessage = '';
    this.bannerText?.setVisible(false);
  }

  destroy(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];
    this.bannerQueue.clear();

    this.scoreText?.destroy();
    this.livesText?.destroy();
    this.bannerText?.destroy();
    this.scoreText = undefined;
    this.livesText = undefined;
    this.bannerText = undefined;
  }

  private syncScore(score: number): void {
    const normalized = Number.isFinite(score)
      ? Math.max(0, Math.floor(score))
      : 0;
    if (normalized === this.lastScore) {
      return;
    }
    this.lastScore = normalized;
    this.scoreText?.setText(`Score: ${normalized}`);
  }

  private syncLives(livesRemaining: number): void {
    const normalized = Number.isFinite(livesRemaining)
      ? Math.max(0, Math.floor(livesRemaining))
      : 0;
    if (normalized === this.lastLives) {
      return;
    }
    this.lastLives = normalized;
    this.livesText?.setText(`Lives: ${normalized}`);
  }
}
