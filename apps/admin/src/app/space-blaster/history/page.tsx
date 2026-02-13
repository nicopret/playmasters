'use client';

import { useEffect, useState } from 'react';
import styles from '../../page.module.css';

type HistoryEntry = {
  versionId: string;
  configHash?: string;
  publishedAt: string;
  publisher?: { id?: string; email?: string; name?: string };
  env: string;
  prevVersionId?: string | null;
};

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/space-blaster/history');
        if (!res.ok) throw new Error('Failed to load history');
        const json = await res.json();
        if (!cancelled) setEntries(json.items ?? []);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className={styles.main}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Published Versions</h1>
          <p className={styles.meta}>Space Blaster bundle history</p>
        </div>
      </div>

      {error && <div className={styles.error}>Error: {error}</div>}
      {loading ? (
        <div>Loading…</div>
      ) : entries.length === 0 ? (
        <div>No published versions yet.</div>
      ) : (
        <div className={styles.card}>
          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span>Published At</span>
              <span>Version (configHash)</span>
              <span>Publisher</span>
              <span>Prev Version</span>
            </div>
            {entries.map((e) => (
              <div
                key={e.versionId + e.publishedAt}
                className={styles.tableRow}
              >
                <span>{new Date(e.publishedAt).toLocaleString()}</span>
                <span>{e.configHash ?? e.versionId}</span>
                <span>
                  {e.publisher?.email ?? e.publisher?.id ?? 'Unknown'}
                </span>
                <span>{e.prevVersionId ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
