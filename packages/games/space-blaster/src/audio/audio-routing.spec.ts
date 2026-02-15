import { mapEventToSfxKey, resolvePauseVolumes } from './audio-routing';

describe('audio-routing', () => {
  it('maps event names to configured sfx keys', () => {
    const keys = {
      fire: 'sfx.fire',
      hit: 'sfx.hit',
      kill: 'sfx.kill',
      tierUp: 'sfx.tier',
      waveClear: 'sfx.wave',
      gameOver: 'sfx.over',
      diveTelegraph: 'sfx.telegraph',
    };
    expect(mapEventToSfxKey({ event: 'fire', keys })).toBe('sfx.fire');
    expect(mapEventToSfxKey({ event: 'gameOver', keys })).toBe('sfx.over');
    expect(mapEventToSfxKey({ event: 'diveTelegraph', keys })).toBe(
      'sfx.telegraph',
    );
  });

  it('returns null for missing/blank keys', () => {
    expect(mapEventToSfxKey({ event: 'fire', keys: {} })).toBeNull();
    expect(
      mapEventToSfxKey({ event: 'fire', keys: { fire: '   ' } }),
    ).toBeNull();
  });

  it('applies pause mode routing', () => {
    expect(
      resolvePauseVolumes({
        mode: 'pause',
        baseMusicVolume: 0.7,
        baseSfxVolume: 0.8,
        duckFactor: 0.4,
        paused: true,
      }),
    ).toEqual({ musicVolume: 0.7, sfxVolume: 0.8, pausedAll: true });

    expect(
      resolvePauseVolumes({
        mode: 'mute',
        baseMusicVolume: 0.7,
        baseSfxVolume: 0.8,
        duckFactor: 0.4,
        paused: true,
      }),
    ).toEqual({ musicVolume: 0, sfxVolume: 0, pausedAll: false });

    expect(
      resolvePauseVolumes({
        mode: 'duck',
        baseMusicVolume: 0.7,
        baseSfxVolume: 0.8,
        duckFactor: 0.4,
        paused: true,
      }),
    ).toEqual({
      musicVolume: expect.closeTo(0.28, 10),
      sfxVolume: 0.8,
      pausedAll: false,
    });
  });
});
