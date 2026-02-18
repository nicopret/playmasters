'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import dashStyles from '../../../../components/AdminDashboard/AdminDashboard.module.css';
import styles from './page.module.css';

type HistoryEntry = {
  versionId: string;
  configHash?: string;
  publishedAt: string;
  publisher?: { id?: string; email?: string; name?: string };
  env: string;
  prevVersionId?: string | null;
};

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Announcements', href: '/announcements' },
  { label: 'Games', href: '/games' },
  { label: 'Assets', href: '/assets' },
];

export default function GameHistoryPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const gameName = useMemo(
    () =>
      (gameId ?? '')
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' '),
    [gameId],
  );

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/${gameId}/history`);
        if (!res.ok) throw new Error('Failed to load history');
        const json = await res.json();
        if (!cancelled) setEntries(json.items ?? []);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  return (
    <div className={dashStyles.shell}>
      <aside className={dashStyles.sidebar}>
        <div className={dashStyles.logoWrap}>
          <Image
            src="/brand/playmaster_logo.png"
            alt="Playmasters logo"
            fill
            sizes="280px"
            className={dashStyles.logo}
            priority
          />
        </div>
        <nav className={dashStyles.menu}>
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`${dashStyles.menuItem} ${
                item.label === 'Games' ? dashStyles.menuActive : ''
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className={dashStyles.main}>
        <header className={dashStyles.pageHeader}>
          <h1>{gameName} Published Versions</h1>
        </header>

        <section className={styles.contentSection}>
          <p className={styles.meta}>{gameName} bundle history</p>

          {error && <div className={styles.error}>Error: {error}</div>}
          {loading ? (
            <div>Loading...</div>
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
                {entries.map((entry) => (
                  <div
                    key={entry.versionId + entry.publishedAt}
                    className={styles.tableRow}
                  >
                    <span>{new Date(entry.publishedAt).toLocaleString()}</span>
                    <span>{entry.configHash ?? entry.versionId}</span>
                    <span>
                      {entry.publisher?.email ??
                        entry.publisher?.id ??
                        'Unknown'}
                    </span>
                    <span>{entry.prevVersionId ?? '-'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
