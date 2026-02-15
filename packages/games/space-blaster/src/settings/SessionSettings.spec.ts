import {
  resolveDefaultSessionSettings,
  setSessionMusicVolume,
  setSessionSfxVolume,
} from './SessionSettings';

const baseConfig = {
  configHash: 'a'.repeat(64),
  gameConfig: { defaultLives: 3 },
  levelConfigs: [
    {
      layoutId: 'layout-a',
      waves: [{ enemyId: 'enemy-a', count: 1 }],
    },
  ],
  heroCatalog: {
    entries: [{ heroId: 'hero-a', defaultAmmoId: 'ammo-a' }],
  },
  enemyCatalog: { entries: [{ enemyId: 'enemy-a' }] },
  ammoCatalog: { entries: [{ ammoId: 'ammo-a' }] },
  formationLayouts: { entries: [{ layoutId: 'layout-a' }] },
  scoreConfig: { baseEnemyScores: [{ enemyId: 'enemy-a', score: 100 }] },
};

describe('SessionSettings', () => {
  it('initializes from audio config when present', () => {
    const settings = resolveDefaultSessionSettings({
      ...baseConfig,
      gameConfig: {
        ...baseConfig.gameConfig,
        audio: {
          music: { volume: 0.4 },
          sfx: { volume: 0.6 },
        },
      },
    } as never);

    expect(settings).toEqual({
      musicVolume: 0.4,
      sfxVolume: 0.6,
      initializedFromConfig: true,
    });
  });

  it('falls back to defaults and clamps updates', () => {
    const settings = resolveDefaultSessionSettings(baseConfig as never);
    expect(settings.musicVolume).toBe(0.7);
    expect(settings.sfxVolume).toBe(0.9);
    expect(settings.initializedFromConfig).toBe(false);

    setSessionMusicVolume(settings, 2);
    setSessionSfxVolume(settings, -1);

    expect(settings.musicVolume).toBe(1);
    expect(settings.sfxVolume).toBe(0);
  });

  it('updates channels independently', () => {
    const settings = resolveDefaultSessionSettings(baseConfig as never);
    const initialSfx = settings.sfxVolume;
    setSessionMusicVolume(settings, 0.22);
    expect(settings.musicVolume).toBe(0.22);
    expect(settings.sfxVolume).toBe(initialSfx);

    const initialMusic = settings.musicVolume;
    setSessionSfxVolume(settings, 0.33);
    expect(settings.sfxVolume).toBe(0.33);
    expect(settings.musicVolume).toBe(initialMusic);
  });
});
