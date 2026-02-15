export type AudioPauseMode = 'pause' | 'mute' | 'duck';

export type AudioEventToSfxKeyArgs = {
  event:
    | 'fire'
    | 'hit'
    | 'kill'
    | 'tierUp'
    | 'waveClear'
    | 'gameOver'
    | 'diveTelegraph';
  keys: Partial<Record<AudioEventToSfxKeyArgs['event'], string>>;
};

export const mapEventToSfxKey = (
  args: AudioEventToSfxKeyArgs,
): string | null => {
  const raw = args.keys[args.event];
  if (typeof raw !== 'string') {
    return null;
  }
  const key = raw.trim();
  return key.length > 0 ? key : null;
};

export const resolvePauseVolumes = (args: {
  mode: AudioPauseMode;
  baseMusicVolume: number;
  baseSfxVolume: number;
  duckFactor: number;
  paused: boolean;
}): { musicVolume: number; sfxVolume: number; pausedAll: boolean } => {
  if (!args.paused) {
    return {
      musicVolume: args.baseMusicVolume,
      sfxVolume: args.baseSfxVolume,
      pausedAll: false,
    };
  }
  if (args.mode === 'pause') {
    return {
      musicVolume: args.baseMusicVolume,
      sfxVolume: args.baseSfxVolume,
      pausedAll: true,
    };
  }
  if (args.mode === 'mute') {
    return {
      musicVolume: 0,
      sfxVolume: 0,
      pausedAll: false,
    };
  }
  return {
    musicVolume: args.baseMusicVolume * args.duckFactor,
    sfxVolume: args.baseSfxVolume,
    pausedAll: false,
  };
};
