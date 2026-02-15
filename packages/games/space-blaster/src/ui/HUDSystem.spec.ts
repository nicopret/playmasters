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

  setOrigin(): this {
    return this;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

describe('HUDSystem', () => {
  const createScene = () => {
    const texts: FakeText[] = [];
    const scene = {
      add: {
        text: () => {
          const t = new FakeText();
          texts.push(t);
          return t;
        },
      },
      scale: {
        width: 800,
      },
    };
    return {
      scene: scene as unknown as Phaser.Scene,
      texts,
    };
  };

  it('reacts to score and lives events immediately', () => {
    const bus = new RunEventBus();
    const { scene, texts } = createScene();
    const scoreSystem = { getState: () => ({ score: 0 }) };
    const hud = new HUDSystem({
      scene,
      ctx: {} as never,
      bus,
      scoreSystem: scoreSystem as never,
      getLives: () => 3,
    });
    hud.create();

    bus.emit(RUN_EVENT.SCORE_CHANGED, {
      score: 120,
      comboCount: 1,
      maxComboCount: 1,
      tierIndex: null,
      nowMs: 10,
    });
    bus.emit(RUN_EVENT.PLAYER_LIVES_CHANGED, {
      livesRemaining: 2,
      nowMs: 11,
    });

    expect(texts[0].text).toBe('Score: 120');
    expect(texts[1].text).toBe('Lives: 2');
  });

  it('queues tier and wave banners sequentially on sim-clock update', () => {
    const bus = new RunEventBus();
    const { scene, texts } = createScene();
    const scoreSystem = { getState: () => ({ score: 0 }) };
    const hud = new HUDSystem({
      scene,
      ctx: {} as never,
      bus,
      scoreSystem: scoreSystem as never,
      getLives: () => 3,
      bannerHideMs: 1000,
    });
    hud.create();

    bus.emit(RUN_EVENT.SCORE_TIER_ENTERED, {
      tierIndex: 1,
      minCount: 3,
      multiplier: 1.5,
      tierBonus: 50,
      comboCount: 3,
      nowMs: 100,
    });
    bus.emit(RUN_EVENT.LEVEL_WAVE_CLEARED, {
      levelNumber: 1,
      waveIndex: 0,
      reason: 'ALL_ENEMIES_DEAD',
      nowMs: 101,
      livesRemaining: 3,
    });

    hud.update(100);
    expect(texts[2].visible).toBe(true);
    expect(texts[2].text).toContain('Tier Up!');

    hud.update(1100);
    expect(texts[2].visible).toBe(true);
    expect(texts[2].text).toBe('Wave Clear!');
  });

  it('pauses banner expiry when sim clock is frozen and hides tier banner on combo break', () => {
    const bus = new RunEventBus();
    const { scene, texts } = createScene();
    const scoreSystem = { getState: () => ({ score: 0 }) };
    const hud = new HUDSystem({
      scene,
      ctx: {} as never,
      bus,
      scoreSystem: scoreSystem as never,
      getLives: () => 3,
      bannerHideMs: 1000,
    });
    hud.create();

    bus.emit(RUN_EVENT.SCORE_TIER_ENTERED, {
      tierIndex: 1,
      minCount: 3,
      multiplier: 1.5,
      tierBonus: 50,
      comboCount: 3,
      nowMs: 100,
    });

    hud.update(100);
    hud.update(100);
    expect(texts[2].visible).toBe(true);

    bus.emit(RUN_EVENT.SCORE_COMBO_RESET, {
      reason: 'EXPIRED',
      nowMs: 101,
    });
    hud.update(101);
    expect(texts[2].visible).toBe(false);

    hud.destroy();
    expect(texts[0].destroyed).toBe(true);
    expect(texts[1].destroyed).toBe(true);
    expect(texts[2].destroyed).toBe(true);
  });
});
