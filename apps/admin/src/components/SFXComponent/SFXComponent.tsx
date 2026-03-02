'use client';

import { useRef, useState } from 'react';
import jsfxr from 'jsfxr';
import styles from './SFXComponent.module.css';
import {
  buildWavFile,
  generateWavBytesFromPreset,
  parsePreset,
} from './sfxUtils';

type SFXComponentProps = {
  gameId: string;
  definitionId: string;
  slotId: string;
  title: string;
  initialPresetJson?: string;
};

type PlayStatus = {
  message: string;
  isError: boolean;
};

export default function SFXComponent({
  gameId,
  definitionId,
  slotId,
  title,
  initialPresetJson = '',
}: SFXComponentProps) {
  const [presetText, setPresetText] = useState(initialPresetJson);
  const [status, setStatus] = useState<PlayStatus | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

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

  const playGeneratedWav = async (wavBytes: Uint8Array) => {
    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;

    if (context.state === 'suspended') {
      await context.resume();
    }

    sourceRef.current?.stop();
    sourceRef.current?.disconnect();

    try {
      const decodeTarget = Uint8Array.from(wavBytes).buffer;
      const audioBuffer = await context.decodeAudioData(decodeTarget);
      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(context.destination);
      source.start();
      sourceRef.current = source;
      return;
    } catch {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      const fallbackBlob = new Blob([Uint8Array.from(wavBytes)], {
        type: 'audio/wav',
      });
      const fallbackUrl = URL.createObjectURL(fallbackBlob);
      audioUrlRef.current = fallbackUrl;
      const fallback = new Audio(fallbackUrl);
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
      const wavBytes = generateWavBytesFromPreset(preset, jsfxr);
      await playGeneratedWav(wavBytes);
      setSuccessStatus('Audio generated');
    } catch (error) {
      setErrorStatus(
        error instanceof Error ? error.message : 'Failed to generate audio',
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const savePresetToDraft = async (args: {
    presetJson: string;
    uploadedFile?: {
      objectKey?: string;
      inlineDataUrl?: string;
      fileName: string;
      contentType: string;
      uploadedAt: string;
    };
  }): Promise<void> => {
    const res = await fetch(`/api/games/${gameId}/assets/sfx-preset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        definitionId,
        presetJson: args.presetJson,
        slotId: args.uploadedFile ? slotId : undefined,
        uploadedFile: args.uploadedFile,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const base = json.error ?? 'Failed to save preset';
      const detail =
        typeof json.details === 'string' && json.details.trim()
          ? `: ${json.details}`
          : '';
      throw new Error(`${base}${detail}`);
    }
  };

  const handleSavePreset = async () => {
    const parsed = parsePreset(presetText, jsfxr.parameters.order);
    if (!parsed.ok) {
      setErrorStatus(parsed.errorMessage);
      return;
    }
    const presetJson = JSON.stringify(parsed.preset, null, 2);

    setIsProcessing(true);
    setStatus(null);
    try {
      await savePresetToDraft({ presetJson });
      setSuccessStatus('Saved preset to draft');
    } catch (error) {
      setErrorStatus(
        error instanceof Error ? error.message : 'Failed to save preset',
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadWav = async () => {
    const preset = parseCurrentPreset();
    if (!preset) return;

    setIsProcessing(true);
    setStatus(null);
    try {
      const wavBytes = generateWavBytesFromPreset(preset, jsfxr);
      const wavFile = buildWavFile(title, wavBytes);
      const form = new FormData();
      form.set('definitionId', definitionId);
      form.set('slotId', slotId);
      form.set('media', 'audio');
      form.set('file', wavFile);

      const uploadRes = await fetch(`/api/games/${gameId}/assets/upload`, {
        method: 'POST',
        body: form,
      });
      const uploadJson = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        const base = uploadJson.error ?? 'Failed to upload WAV';
        const detail =
          typeof uploadJson.details === 'string' && uploadJson.details.trim()
            ? `: ${uploadJson.details}`
            : '';
        throw new Error(`${base}${detail}`);
      }

      const presetJson = JSON.stringify(preset, null, 2);
      await savePresetToDraft({
        presetJson,
        uploadedFile: uploadJson.file,
      });
      setSuccessStatus('Uploaded WAV + saved preset');
    } catch (error) {
      setErrorStatus(
        error instanceof Error ? error.message : 'Failed to upload WAV',
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
            placeholder=""
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
                onClick={() => void handleSavePreset()}
                disabled={isProcessing}
              >
                Save Preset
              </button>
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => void handleUploadWav()}
                disabled={isProcessing}
              >
                Upload WAV
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
