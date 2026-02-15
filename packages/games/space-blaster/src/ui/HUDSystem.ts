import type * as Phaser from 'phaser';
import type { RunContext } from '../runtime';
import { RUN_EVENT, type RunEventBus } from '../run';
import type { ScoreSystem } from '../scoring';

const DEFAULT_BANNER_HIDE_MS = 1500;

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

  private scoreText?: Phaser.GameObjects.Text;
  private livesText?: Phaser.GameObjects.Text;
  private comboBannerText?: Phaser.GameObjects.Text;
  private bannerHideTimer?: Phaser.Time.TimerEvent;
  private unsubscribers: Array<() => void> = [];

  private lastScore = Number.NaN;
  private lastLives = Number.NaN;

  constructor(options: HUDSystemOptions) {
    this.scene = options.scene;
    this.bus = options.bus;
    this.scoreSystem = options.scoreSystem;
    this.getLives = options.getLives;
    this.bannerHideMs = options.bannerHideMs ?? DEFAULT_BANNER_HIDE_MS;
  }

  create(): void {
    this.scoreText = this.scene.add.text(16, 12, 'Score: 0', {
      fontFamily: 'Montserrat, Arial, sans-serif',
      fontSize: '18px',
      color: '#f9d65c',
    });
    this.livesText = this.scene.add.text(16, 34, 'Lives: 0', {
      fontFamily: 'Montserrat, Arial, sans-serif',
      fontSize: '16px',
      color: '#d5d8e0',
    });
    this.comboBannerText = this.scene.add
      .text(16, 82, '', {
        fontFamily: 'Montserrat, Arial, sans-serif',
        fontSize: '16px',
        color: '#7df9ff',
      })
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
        this.showComboBanner(payload.tierIndex, payload.multiplier);
      }),
      this.bus.on(RUN_EVENT.SCORE_COMBO_RESET, () => {
        this.hideComboBanner();
      }),
    ];
  }

  destroy(): void {
    this.clearBannerHideTimer();
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];

    this.scoreText?.destroy();
    this.livesText?.destroy();
    this.comboBannerText?.destroy();
    this.scoreText = undefined;
    this.livesText = undefined;
    this.comboBannerText = undefined;
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

  private showComboBanner(tierIndex: number, multiplier: number): void {
    if (!this.comboBannerText) return;
    this.comboBannerText.setText(
      `Tier Up! Tier ${tierIndex + 1} x${multiplier.toFixed(2)}`,
    );
    this.comboBannerText.setVisible(true);
    this.clearBannerHideTimer();
    this.bannerHideTimer = this.scene.time.delayedCall(
      this.bannerHideMs,
      () => {
        this.hideComboBanner();
      },
    );
  }

  private hideComboBanner(): void {
    this.comboBannerText?.setVisible(false);
    this.clearBannerHideTimer();
  }

  private clearBannerHideTimer(): void {
    this.bannerHideTimer?.remove(false);
    this.bannerHideTimer = undefined;
  }
}
