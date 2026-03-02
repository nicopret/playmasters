'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import dashStyles from '../../../../components/AdminDashboard/AdminDashboard.module.css';
import styles from './page.module.css';

type LevelSummary = {
  levelId: string;
  updatedAt?: string;
};

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Announcements', href: '/announcements' },
  { label: 'Games', href: '/games' },
  { label: 'Assets', href: '/assets' },
];

const normalizeLevelId = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_ ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

export default function LevelsIndexPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const router = useRouter();
  const [levels, setLevels] = useState<LevelSummary[]>([]);
  const [levelName, setLevelName] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gameName = useMemo(
    () =>
      (gameId ?? '')
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' '),
    [gameId],
  );

  const loadLevels = async () => {
    if (!gameId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${gameId}/levels`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load levels');
      const json = await res.json();
      const nextLevels: LevelSummary[] = Array.isArray(json.levels)
        ? json.levels.map(
            (level: { levelId?: unknown; updatedAt?: unknown }) => ({
              levelId: String(level.levelId ?? ''),
              updatedAt:
                typeof level.updatedAt === 'string'
                  ? level.updatedAt
                  : undefined,
            }),
          )
        : [];
      nextLevels.sort((left, right) =>
        String(left.levelId).localeCompare(String(right.levelId)),
      );
      setLevels(nextLevels.filter((level) => level.levelId.length > 0));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLevels();
  }, [gameId]);

  const onCreate = async () => {
    const levelId = normalizeLevelId(levelName);
    if (!levelId) {
      setError('Enter a valid level name before creating.');
      return;
    }
    if (levels.some((level) => level.levelId === levelId)) {
      setError(`Level "${levelId}" already exists.`);
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${gameId}/levels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ levelId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        if (json.error === 'level_already_exists') {
          throw new Error(`Level "${levelId}" already exists.`);
        }
        throw new Error(json.error ?? 'Failed to create level');
      }
      router.push(`/games/${gameId}/levels/${encodeURIComponent(levelId)}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const onOpen = (levelId: string) => {
    router.push(`/games/${gameId}/levels/${encodeURIComponent(levelId)}`);
  };

  const onDelete = async (levelId: string) => {
    const confirmed = window.confirm(
      `Delete level "${levelId}"? This removes its saved level config.`,
    );
    if (!confirmed) return;

    setDeleting((current) => ({ ...current, [levelId]: true }));
    setError(null);
    try {
      const res = await fetch(
        `/api/games/${gameId}/levels/${encodeURIComponent(levelId)}`,
        {
          method: 'DELETE',
        },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? 'Failed to delete level');
      }
      setLevels((current) =>
        current.filter((level) => level.levelId !== levelId),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting((current) => {
        const next = { ...current };
        delete next[levelId];
        return next;
      });
    }
  };

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
          <h1>{gameName} Levels</h1>
        </header>

        <section className={styles.contentSection}>
          <p className={styles.meta}>
            Create and manage levels for {gameName}.
          </p>
          <div className={styles.createRow}>
            <input
              className={styles.input}
              type="text"
              placeholder="Enter level name (example: level-1)"
              value={levelName}
              onChange={(event) => setLevelName(event.target.value)}
            />
            <button
              className={styles.primaryButton}
              onClick={() => void onCreate()}
              disabled={creating}
            >
              {creating ? 'Creating...' : 'Create Level'}
            </button>
          </div>

          {error ? <div className={styles.error}>Error: {error}</div> : null}

          {loading ? (
            <div>Loading levels...</div>
          ) : levels.length === 0 ? (
            <div className={styles.empty}>
              No levels found. Create your first level above.
            </div>
          ) : (
            <div className={styles.card}>
              <div className={styles.table}>
                <div className={styles.tableHeader}>
                  <span>Level</span>
                  <span>Updated</span>
                  <span>Actions</span>
                </div>
                {levels.map((level) => (
                  <div key={level.levelId} className={styles.tableRow}>
                    <button
                      className={styles.levelLink}
                      onClick={() => onOpen(level.levelId)}
                    >
                      {level.levelId}
                    </button>
                    <span>
                      {level.updatedAt
                        ? new Date(level.updatedAt).toLocaleString()
                        : '-'}
                    </span>
                    <div className={styles.actionsCell}>
                      <button
                        className={styles.secondaryButton}
                        onClick={() => onOpen(level.levelId)}
                      >
                        Open
                      </button>
                      <button
                        className={styles.dangerButton}
                        onClick={() => void onDelete(level.levelId)}
                        disabled={!!deleting[level.levelId]}
                      >
                        {deleting[level.levelId] ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Link href={`/games/${gameId}`} className={styles.backLink}>
            Back to {gameName} admin
          </Link>
        </section>
      </main>
    </div>
  );
}
