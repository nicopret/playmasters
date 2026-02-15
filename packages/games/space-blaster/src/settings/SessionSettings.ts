import type { ResolvedGameConfigV1 } from '@playmasters/types';

export type SessionSettings = {
  musicVolume: number;
  sfxVolume: number;
  initializedFromConfig: boolean;
};

const DEFAULT_MUSIC_VOLUME = 0.7;
const DEFAULT_SFX_VOLUME = 0.9;

const clampVolume = (value: number, fallback: number): number => {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, value));
};

export const resolveDefaultSessionSettings = (
  resolvedConfig: ResolvedGameConfigV1,
): SessionSettings => {
  const audio = (
    resolvedConfig.gameConfig as {
      audio?: {
        music?: { volume?: number };
        sfx?: { volume?: number };
      };
    }
  ).audio;

  const musicVolume = clampVolume(
    audio?.music?.volume ?? DEFAULT_MUSIC_VOLUME,
    DEFAULT_MUSIC_VOLUME,
  );
  const sfxVolume = clampVolume(
    audio?.sfx?.volume ?? DEFAULT_SFX_VOLUME,
    DEFAULT_SFX_VOLUME,
  );
  const initializedFromConfig =
    typeof audio?.music?.volume === 'number' ||
    typeof audio?.sfx?.volume === 'number';

  return {
    musicVolume,
    sfxVolume,
    initializedFromConfig,
  };
};

export const setSessionMusicVolume = (
  settings: SessionSettings,
  volume: number,
): void => {
  settings.musicVolume = clampVolume(volume, settings.musicVolume);
};

export const setSessionSfxVolume = (
  settings: SessionSettings,
  volume: number,
): void => {
  settings.sfxVolume = clampVolume(volume, settings.sfxVolume);
};
