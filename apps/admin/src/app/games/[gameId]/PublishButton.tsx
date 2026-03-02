'use client';

import { useState } from 'react';
import styles from './page.module.css';

export default function PublishButton({ gameId }: { gameId: string }) {
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onPublish = async () => {
    if (gameId !== 'space-blaster') {
      setError('Publish is currently supported only for space-blaster.');
      return;
    }

    setPublishing(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/space-blaster/publish?env=dev', {
        method: 'POST',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? 'Publish failed');
      }
      setMessage(`Published version ${json.versionId}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className={styles.publishRow}>
      <button
        type="button"
        className={styles.publishButton}
        onClick={() => void onPublish()}
        disabled={publishing}
      >
        {publishing ? 'Publishing...' : 'Publish to Game Site'}
      </button>
      {message ? <div className={styles.success}>{message}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}
    </div>
  );
}

