import {
  buildWavFile,
  generateWavBytesFromPreset,
  normalizePreset,
  parsePreset,
  sanitizeFileBase,
  wavDataUriToUint8Array,
} from './sfxUtils';

describe('sfxUtils', () => {
  it('sanitizeFileBase should normalize title to safe kebab-case', () => {
    expect(sanitizeFileBase('Player Fire')).toBe('player-fire');
    expect(sanitizeFileBase('  Enemy__Fire!!  ')).toBe('enemy_fire');
  });

  it('parsePreset returns invalid-json error on malformed payload', () => {
    const result = parsePreset('{', ['wave_type']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorMessage).toBe('Invalid JSON preset');
    }
  });

  it('wavDataUriToUint8Array decodes a data uri into bytes', () => {
    const bytes = wavDataUriToUint8Array('data:audio/wav;base64,UklGRg==');
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('normalizePreset defaults sample_rate and forces sample_size 16', () => {
    const preset = normalizePreset({ wave_type: 0 }, ['wave_type']);
    expect(preset.sample_rate).toBe(44100);
    expect(preset.sample_size).toBe(16);

    const presetWithValues = normalizePreset(
      { wave_type: 0, sample_rate: 22050, sample_size: 8 },
      ['wave_type'],
    );
    expect(presetWithValues.sample_rate).toBe(22050);
    expect(presetWithValues.sample_size).toBe(16);
  });

  it('buildWavFile returns wav file with sanitized name and audio type', () => {
    const file = buildWavFile('Player Fire', new Uint8Array([1, 2, 3]));
    expect(file.name).toBe('player-fire.wav');
    expect(file.type).toBe('audio/wav');
    expect(file.size).toBe(3);
  });

  it('generateWavBytesFromPreset reads bytes from jsfxr data URI', () => {
    const bytes = generateWavBytesFromPreset(
      { wave_type: 0 },
      {
        sfxr: {
          toWave: () => ({
            dataURI: 'data:audio/wav;base64,UklGRg==',
          }),
        },
      },
    );
    expect(bytes.length).toBeGreaterThan(0);
  });
});
