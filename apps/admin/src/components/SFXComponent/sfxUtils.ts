export type SynthPreset = Record<string, number>;
export type JsfxrWave = { dataURI: string };
export type JsfxrModuleLike = {
  sfxr: {
    toWave: (preset: SynthPreset) => JsfxrWave;
  };
};

export type ParsePresetResult =
  | { ok: true; preset: SynthPreset }
  | { ok: false; errorMessage: string };

const DEFAULT_SOUND_VOL = 0.5;
const DEFAULT_SAMPLE_RATE = 44100;
const WAV_SAMPLE_SIZE = 16;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toSynthDefFromValues = (
  values: unknown[],
  order: string[],
): SynthPreset => {
  const synthDef: SynthPreset = {};
  order.forEach((key, index) => {
    const raw = values[index];
    if (typeof raw !== 'number' || Number.isNaN(raw)) {
      throw new Error('Preset values must be numbers');
    }
    synthDef[key] = raw;
  });
  return synthDef;
};

export const normalizePreset = (
  value: unknown,
  parameterOrder: string[],
): SynthPreset => {
  if (Array.isArray(value)) {
    return {
      ...toSynthDefFromValues(value, parameterOrder),
      sound_vol: DEFAULT_SOUND_VOL,
      sample_rate: DEFAULT_SAMPLE_RATE,
      sample_size: WAV_SAMPLE_SIZE,
    };
  }

  if (isRecord(value) && Array.isArray(value.params)) {
    const base = toSynthDefFromValues(value.params, parameterOrder);
    const soundVol = value.sound_vol;
    const sampleRate = value.sample_rate;
    return {
      ...base,
      sound_vol:
        typeof soundVol === 'number' && Number.isFinite(soundVol)
          ? soundVol
          : DEFAULT_SOUND_VOL,
      sample_rate:
        typeof sampleRate === 'number' &&
        Number.isFinite(sampleRate) &&
        sampleRate > 0
          ? sampleRate
          : DEFAULT_SAMPLE_RATE,
      sample_size: WAV_SAMPLE_SIZE,
    };
  }

  if (!isRecord(value)) {
    throw new Error('Preset must be a JSON object or parameter array');
  }

  const synthDef: SynthPreset = {};
  parameterOrder.forEach((key) => {
    const raw = value[key];
    if (typeof raw !== 'number' || Number.isNaN(raw)) {
      throw new Error(`Missing or invalid numeric value for '${key}'`);
    }
    synthDef[key] = raw;
  });

  const soundVol = value.sound_vol;
  const sampleRate = value.sample_rate;
  synthDef.sound_vol =
    typeof soundVol === 'number' && Number.isFinite(soundVol)
      ? soundVol
      : DEFAULT_SOUND_VOL;
  synthDef.sample_rate =
    typeof sampleRate === 'number' &&
    Number.isFinite(sampleRate) &&
    sampleRate > 0
      ? sampleRate
      : DEFAULT_SAMPLE_RATE;
  synthDef.sample_size = WAV_SAMPLE_SIZE;
  return synthDef;
};

export const parsePreset = (
  text: string,
  parameterOrder: string[],
): ParsePresetResult => {
  try {
    const parsed = JSON.parse(text);
    return { ok: true, preset: normalizePreset(parsed, parameterOrder) };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { ok: false, errorMessage: 'Invalid JSON preset' };
    }
    return {
      ok: false,
      errorMessage:
        error instanceof Error ? error.message : 'Failed to parse preset',
    };
  }
};

export const sanitizeFileBase = (title: string): string => {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/_+/g, '_')
    .replace(/^[-_]+|[-_]+$/g, '');

  return normalized || 'sfx';
};

export const wavDataUriToUint8Array = (dataUri: string): Uint8Array => {
  const base64Payload = dataUri.split(',')[1];
  if (!base64Payload) {
    throw new Error('Invalid WAV data URI');
  }

  if (typeof atob === 'function') {
    const decoded = atob(base64Payload);
    const bytes = new Uint8Array(decoded.length);
    for (let idx = 0; idx < decoded.length; idx += 1) {
      bytes[idx] = decoded.charCodeAt(idx);
    }
    return bytes;
  }

  const bufferCtor = (
    globalThis as unknown as {
      Buffer?: { from: (input: string, encoding: 'base64') => Uint8Array };
    }
  ).Buffer;
  if (!bufferCtor) {
    throw new Error('Base64 decoder unavailable');
  }
  return Uint8Array.from(bufferCtor.from(base64Payload, 'base64'));
};

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const generateWavBytesFromPreset = (
  preset: SynthPreset,
  generator: JsfxrModuleLike,
): Uint8Array => {
  const wave = generator.sfxr.toWave(preset);
  return wavDataUriToUint8Array(wave.dataURI);
};

export const buildWavFile = (title: string, wavBytes: Uint8Array): File => {
  const fileBase = sanitizeFileBase(title);
  const name = `${fileBase}.wav`;
  const bytes = Uint8Array.from(wavBytes);
  return new File([bytes], name, { type: 'audio/wav' });
};
