import type * as Phaser from 'phaser';
import { RUN_EVENT, RunEventBus } from '../run';
import { HUDSystem } from './HUDSystem';

class FakeText {
  text = '';
  visible = true;
  destroyed = false;

  setText(next: string): this {
    this.text = next;
    return this;
  }

  setVisible(next: boolean): this {
    this.visible = next;
    return this;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

describe('HUDSystem', () => {
  const createScene = () => {
    const texts: FakeText[] = [];
    const timers: Array<{ callback: () => void; removed: boolean }> = [];
    const scene = {
      add: {
        text: () => {
          const t = new FakeText();
          texts.push(t);
          return t;
        },
      },
      time: {
        delayedCall: (_delay: number, callback: () => void) => {
          const timer = { callback, removed: false };
          timers.push(timer);
          return {
            remove: () => {
              timer.removed = true;
            },
          };
        },
      },
    };
    return {
      scene: scene as unknown as Phaser.Scene,
      texts,
      timers,
    };
  };

  it('reacts to score/lives/tier and hides banner on combo reset', () => {
    const bus = new RunEventBus();
    const { scene, texts, timers } = createScene();
    const scoreSystem = {
      getState: () => ({ score: 0 }),
    };
    let lives = 3;
    const hud = new HUDSystem({
      scene,
      // ctx is DI-only for this system and unused in behavior; cast for test.
      ctx: {} as never,
      bus,
      scoreSystem: scoreSystem as never,
      getLives: () => lives,
      bannerHideMs: 1000,
    });

    hud.create();
    expect(texts[0].text).toBe('Score: 0');
    expect(texts[1].text).toBe('Lives: 3');
    expect(texts[2].visible).toBe(false);

    bus.emit(RUN_EVENT.SCORE_CHANGED, {
      score: 120,
      comboCount: 1,
      maxComboCount: 1,
      tierIndex: null,
      nowMs: 10,
    });
    expect(texts[0].text).toBe('Score: 120');

    lives = 2;
    bus.emit(RUN_EVENT.PLAYER_LIVES_CHANGED, {
      livesRemaining: 2,
      nowMs: 11,
    });
    expect(texts[1].text).toBe('Lives: 2');

    bus.emit(RUN_EVENT.SCORE_TIER_ENTERED, {
      tierIndex: 1,
      minCount: 3,
      multiplier: 1.5,
      tierBonus: 50,
      comboCount: 3,
      nowMs: 12,
    });
    expect(texts[2].visible).toBe(true);
    expect(texts[2].text).toBe('Tier Up! Tier 2 x1.50');
    expect(timers).toHaveLength(1);

    bus.emit(RUN_EVENT.SCORE_COMBO_RESET, {
      reason: 'EXPIRED',
      nowMs: 13,
    });
    expect(texts[2].visible).toBe(false);

    hud.destroy();
    expect(texts[0].destroyed).toBe(true);
    expect(texts[1].destroyed).toBe(true);
    expect(texts[2].destroyed).toBe(true);
  });
});
