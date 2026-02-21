'use client';

import { useRef, useState } from 'react';
import jsfxr from 'jsfxr';
import styles from './SFXComponent.module.css';
import {
  downloadBlob,
  parsePreset,
  sanitizeFileBase,
  wavDataUriToUint8Array,
} from './sfxUtils';

const PRESET_EXAMPLE = `{
  "wave_type": 0,
  "p_env_attack": 0,
  "p_env_sustain": 0.3,
  "p_env_punch": 0,
  "p_env_decay": 0.4,
  "p_base_freq": 0.3,
  "p_freq_limit": 0,
  "p_freq_ramp": 0,
  "p_freq_dramp": 0,
  "p_vib_strength": 0,
  "p_vib_speed": 0,
  "p_arp_mod": 0,
  "p_arp_speed": 0,
  "p_duty": 0,
  "p_duty_ramp": 0,
  "p_repeat_speed": 0,
  "p_pha_offset": 0,
  "p_pha_ramp": 0,
  "p_lpf_freq": 1,
  "p_lpf_ramp": 0,
  "p_lpf_resonance": 0,
  "p_hpf_freq": 0,
  "p_hpf_ramp": 0
}`;

type SFXComponentProps = {
  title: string;
};

type PlayStatus = {
  message: string;
  isError: boolean;
};

type WavData = {
  kind: 'dataUri';
  dataUri: string;
  bytes: Uint8Array;
};

const generateWavData = (preset: Record<string, number>): WavData => {
  const wave = jsfxr.sfxr.toWave(preset);
  const bytes = wavDataUriToUint8Array(wave.dataURI);
  return {
    kind: 'dataUri',
    dataUri: wave.dataURI,
    bytes,
  };
};

export default function SFXComponent({ title }: SFXComponentProps) {
  const [presetText, setPresetText] = useState('');
  const [status, setStatus] = useState<PlayStatus | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const setErrorStatus = (message: string) => {
    setStatus({ message, isError: true });
  };

  const setSuccessStatus = (message: string) => {
    setStatus({ message, isError: false });
  };

  const parseCurrentPreset = () => {
    const parsed = parsePreset(presetText, jsfxr.parameters.order);
    if (!parsed.ok) {
      setErrorStatus(parsed.errorMessage);
      return null;
    }
    return parsed.preset;
  };

  const playGeneratedWav = async (wavData: WavData) => {
    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;

    if (context.state === 'suspended') {
      await context.resume();
    }

    sourceRef.current?.stop();
    sourceRef.current?.disconnect();

    try {
      const decodeTarget = Uint8Array.from(wavData.bytes).buffer;
      const audioBuffer = await context.decodeAudioData(decodeTarget);
      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(context.destination);
      source.start();
      sourceRef.current = source;
      return;
    } catch {
      const fallback = new Audio(wavData.dataUri);
      audioRef.current?.pause();
      audioRef.current = fallback;
      await fallback.play();
    }
  };

  const handlePlay = async () => {
    const preset = parseCurrentPreset();
    if (!preset) return;

    setIsProcessing(true);
    setStatus(null);
    try {
      const wavData = generateWavData(preset);
      await playGeneratedWav(wavData);
      setSuccessStatus('Audio generated');
    } catch (error) {
      setErrorStatus(
        error instanceof Error ? error.message : 'Failed to generate audio',
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveJson = () => {
    try {
      JSON.parse(presetText);
    } catch {
      setErrorStatus('Invalid JSON preset');
      return;
    }

    const fileBase = sanitizeFileBase(title);
    const filename = `${fileBase}.jsfxr.json`;
    const blob = new Blob([presetText], { type: 'application/json' });
    downloadBlob(blob, filename);
    setSuccessStatus(`Saved JSON: ${filename}`);
  };

  const handleSaveWav = async () => {
    const preset = parseCurrentPreset();
    if (!preset) return;

    setIsProcessing(true);
    setStatus(null);
    try {
      const wavData = generateWavData(preset);
      const fileBase = sanitizeFileBase(title);
      const filename = `${fileBase}.wav`;
      const blob = new Blob([Uint8Array.from(wavData.bytes)], {
        type: 'audio/wav',
      });
      downloadBlob(blob, filename);
      setSuccessStatus(`Saved WAV: ${filename}`);
    } catch (error) {
      setErrorStatus(
        error instanceof Error ? error.message : 'Failed to save WAV',
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <article className={styles.root}>
      <div className={styles.layout}>
        <header className={styles.nameRow}>
          <h3 className={styles.heading}>{title}</h3>
        </header>

        <section className={styles.leftPanel}>
          <h4 className={styles.panelTitle}>jsfxr JSON</h4>
          <textarea
            className={styles.presetTextArea}
            value={presetText}
            onChange={(event) => setPresetText(event.target.value)}
            placeholder={PRESET_EXAMPLE}
            spellCheck={false}
            aria-label={`${title} jsfxr JSON`}
          />
        </section>

        <section className={styles.rightPanel}>
          <div className={styles.playArea}>
            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => void handlePlay()}
                disabled={isProcessing}
              >
                {isProcessing ? 'Working...' : 'Play'}
              </button>
              <button
                type="button"
                className={styles.actionButton}
                onClick={handleSaveJson}
                disabled={isProcessing}
              >
                Save JSON
              </button>
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => void handleSaveWav()}
                disabled={isProcessing}
              >
                Save WAV
              </button>
            </div>
            <p
              className={`${styles.status} ${status?.isError ? styles.statusError : ''}`}
            >
              {status?.message ?? 'Paste a preset JSON and click Play.'}
            </p>
          </div>
        </section>
      </div>
    </article>
  );
}
