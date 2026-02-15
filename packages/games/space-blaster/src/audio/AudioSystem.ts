import type * as Phaser from 'phaser';
import type { EnemyCatalogEntryV1 } from '@playmasters/types';
import type { RunContext } from '../runtime';
import { RUN_EVENT, type RunEventBus } from '../run';
import {
  mapEventToSfxKey,
  resolvePauseVolumes,
  type AudioPauseMode,
} from './audio-routing';
import {
  resolveDefaultSessionSettings,
  setSessionMusicVolume,
  setSessionSfxVolume,
} from '../settings/SessionSettings';

type AudioConfig = {
  music: {
    trackKey?: string;
    volume: number;
    enabled: boolean;
  };
  sfx: {
    volume: number;
    enabled: boolean;
    keys: {
      fire?: string;
      hit?: string;
      kill?: string;
      tierUp?: string;
      waveClear?: string;
      gameOver?: string;
      diveTelegraph?: string;
    };
  };
  pauseBehavior: {
    mode: AudioPauseMode;
    duckFactor: number;
  };
};

type AudioSystemOptions = {
  scene: Phaser.Scene;
  ctx: RunContext;
  bus: RunEventBus;
};

const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  music: {
    trackKey: undefined,
    volume: 0.5,
    enabled: true,
  },
  sfx: {
    volume: 0.8,
    enabled: true,
    keys: {},
  },
  pauseBehavior: {
    mode: 'pause',
    duckFactor: 0.35,
  },
};

const isDevRuntime = (): boolean => {
  const globalWithProcess = globalThis as {
    process?: { env?: { NODE_ENV?: string } };
  };
  return globalWithProcess.process?.env?.NODE_ENV !== 'production';
};

export class AudioSystem {
  private readonly scene: Phaser.Scene;
  private readonly bus: RunEventBus;
  private readonly ctx: RunContext;
  private readonly config: AudioConfig;
  private readonly enemyById = new Map<string, EnemyCatalogEntryV1>();
  private readonly unsubscribers: Array<() => void> = [];

  private music?: Phaser.Sound.BaseSound;
  private overlayPaused = false;
  private pausedAllActive = false;
  private musicVolume: number;
  private sfxVolume: number;
  private lastWaveSfxKey = '';

  constructor(options: AudioSystemOptions) {
    this.scene = options.scene;
    this.bus = options.bus;
    this.ctx = options.ctx;
    for (const enemy of options.ctx.resolvedConfig.enemyCatalog.entries) {
      this.enemyById.set(enemy.enemyId, enemy);
    }

    const resolved = (
      options.ctx.resolvedConfig.gameConfig as {
        audio?: Partial<AudioConfig>;
      }
    ).audio;

    this.config = {
      music: {
        ...DEFAULT_AUDIO_CONFIG.music,
        ...(resolved?.music ?? {}),
      },
      sfx: {
        ...DEFAULT_AUDIO_CONFIG.sfx,
        ...(resolved?.sfx ?? {}),
        keys: {
          ...DEFAULT_AUDIO_CONFIG.sfx.keys,
          ...(resolved?.sfx?.keys ?? {}),
        },
      },
      pauseBehavior: {
        ...DEFAULT_AUDIO_CONFIG.pauseBehavior,
        ...(resolved?.pauseBehavior ?? {}),
      },
    };

    const sessionSettings =
      this.ctx.sessionSettings ??
      resolveDefaultSessionSettings(options.ctx.resolvedConfig);
    this.ctx.sessionSettings = sessionSettings;

    this.musicVolume = Math.max(0, Math.min(1, sessionSettings.musicVolume));
    this.sfxVolume = Math.max(0, Math.min(1, sessionSettings.sfxVolume));

    const hero = options.ctx.resolvedConfig.heroCatalog.entries[0];
    const defaultAmmoId = hero?.defaultAmmoId;
    const ammo = options.ctx.resolvedConfig.ammoCatalog.entries.find(
      (entry) => entry.ammoId === defaultAmmoId,
    );
    this.config.sfx.keys.fire ??= hero?.fireSfxKey ?? ammo?.fireSfxKey;
    this.config.sfx.keys.hit ??= hero?.hitSfxKey;
  }

  start(): void {
    this.startMusic();
    this.unsubscribers.push(
      this.bus.on(RUN_EVENT.PLAYER_SHOT_FIRED, () =>
        this.playConfiguredSfx('fire'),
      ),
      this.bus.on(RUN_EVENT.PLAYER_HIT, () => this.playConfiguredSfx('hit')),
      this.bus.on(RUN_EVENT.ENEMY_KILLED, ({ enemyId }) => {
        const key = this.enemyById.get(enemyId)?.deathSfxKey;
        this.playSfxWithFallback('kill', key);
      }),
      this.bus.on(RUN_EVENT.SCORE_TIER_ENTERED, () =>
        this.playConfiguredSfx('tierUp'),
      ),
      this.bus.on(
        RUN_EVENT.LEVEL_WAVE_CLEARED,
        ({ levelNumber, waveIndex }) => {
          const waveKey = `${levelNumber}:${waveIndex}`;
          if (waveKey === this.lastWaveSfxKey) {
            return;
          }
          this.lastWaveSfxKey = waveKey;
          this.playConfiguredSfx('waveClear');
        },
      ),
      this.bus.on(RUN_EVENT.ENDING, () => this.playConfiguredSfx('gameOver')),
      this.bus.on(RUN_EVENT.ENEMY_DIVE_TELEGRAPH, ({ enemyId }) => {
        const key = enemyId
          ? this.enemyById.get(enemyId)?.diveTelegraphSfxKey
          : undefined;
        this.playSfxWithFallback('diveTelegraph', key);
      }),
    );
  }

  stop(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers.length = 0;
    if (this.music) {
      this.music.stop();
      this.music.destroy();
      this.music = undefined;
    }
    this.scene.sound.stopAll();
  }

  setPauseOverlayActive(paused: boolean): void {
    if (paused === this.overlayPaused) return;
    this.overlayPaused = paused;
    const pauseRouting = resolvePauseVolumes({
      mode: this.config.pauseBehavior.mode,
      baseMusicVolume: this.musicVolume,
      baseSfxVolume: this.sfxVolume,
      duckFactor: Math.max(
        0,
        Math.min(1, this.config.pauseBehavior.duckFactor),
      ),
      paused,
    });

    if (pauseRouting.pausedAll) {
      if (paused) {
        this.scene.sound.pauseAll();
        this.pausedAllActive = true;
      } else if (this.pausedAllActive) {
        this.scene.sound.resumeAll();
        this.pausedAllActive = false;
      }
    }

    this.applyMusicVolume(pauseRouting.musicVolume);
    this.scene.sound.volume = pauseRouting.sfxVolume;
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.ctx.sessionSettings) {
      setSessionMusicVolume(this.ctx.sessionSettings, this.musicVolume);
    }
    if (this.music && !this.overlayPaused) {
      this.applyMusicVolume(this.musicVolume);
    }
  }

  setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    if (this.ctx.sessionSettings) {
      setSessionSfxVolume(this.ctx.sessionSettings, this.sfxVolume);
    }
    if (!this.overlayPaused) {
      this.scene.sound.volume = this.sfxVolume;
    }
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  private startMusic(): void {
    if (!this.config.music.enabled) return;
    const key = this.config.music.trackKey?.trim();
    if (!key) return;
    try {
      this.music = this.scene.sound.add(key, {
        loop: true,
        volume: this.musicVolume,
      });
      this.music.play();
    } catch (error) {
      this.warnDev(`Audio music missing: ${key}`, error);
    }
  }

  private playConfiguredSfx(eventName: keyof AudioConfig['sfx']['keys']): void {
    this.playSfxWithFallback(eventName, undefined);
  }

  private playSfxWithFallback(
    eventName: keyof AudioConfig['sfx']['keys'],
    fallback?: string,
  ): void {
    if (!this.config.sfx.enabled) {
      return;
    }
    const keyFromConfig = mapEventToSfxKey({
      event: eventName,
      keys: this.config.sfx.keys,
    });
    const key = (fallback?.trim() || keyFromConfig || '').trim();
    if (!key) return;
    try {
      this.scene.sound.play(key, { volume: this.sfxVolume });
    } catch (error) {
      this.warnDev(`Audio sfx missing: ${key}`, error);
    }
  }

  private warnDev(message: string, error: unknown): void {
    if (!isDevRuntime()) {
      return;
    }
    const detail = error instanceof Error ? error.message : String(error ?? '');
    console.warn(`[AudioSystem] ${message}${detail ? ` (${detail})` : ''}`);
  }

  private applyMusicVolume(volume: number): void {
    if (!this.music) {
      return;
    }
    (this.music as unknown as { volume: number }).volume = volume;
  }
}
