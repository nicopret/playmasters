'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './page.module.css';

const TYPES: Array<{ value: string; label: string }> = [
  { value: 'background', label: 'Background' },
  { value: 'sprite', label: 'Sprite' },
  { value: 'splash', label: 'Splash' },
  { value: 'ui', label: 'UI' },
];

export const dynamic = 'force-dynamic';

export default function EditorImagesNewPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState('background');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);
    if (!file) {
      setError('Choose an image file.');
      return;
    }
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    const form = new FormData();
    form.set('file', file);
    form.set('type', type);
    form.set('title', title.trim());

    setSubmitting(true);
    try {
      const res = await fetch('/api/assets', { method: 'POST', body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? `Upload failed (${res.status})`);
      }
      const assetId = json.asset?.assetId;
      setStatus('Uploaded');
      if (assetId) router.push(`/editor/images/${assetId}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.kicker}>Image Editor</div>
        <h1 className={styles.title}>Upload New Asset</h1>
        <p className={styles.subtitle}>Upload an image to start a new asset draft.</p>
      </header>

      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.field}>
          <label className={styles.label}>Image file</label>
          <input
            className={styles.input}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <div className={styles.helper}>PNG / JPG / WEBP. Max size set by backend config.</div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Type</label>
          <select className={styles.select} value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Title</label>
          <input
            className={styles.input}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Hero Banner v1"
          />
        </div>

        <div className={styles.actions}>
          <button className={styles.button} type="submit" disabled={submitting}>
            {submitting ? 'Uploading…' : 'Submit'}
          </button>
          {status ? <div className={styles.success}>{status}</div> : null}
          {error ? <div className={styles.error}>{error}</div> : null}
        </div>
      </form>
    </div>
  );
}
