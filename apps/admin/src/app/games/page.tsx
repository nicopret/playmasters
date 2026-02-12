'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from '../page.module.css';

const games = [
  {
    id: 'space-blaster',
    name: 'Space Blaster',
    description:
      'Vertical shooter configs (LevelConfig, formations, catalogs).',
  },
];

export default function GamesIndex() {
  const router = useRouter();
  const [levelId, setLevelId] = useState('');

  const onOpenLevel = (gameId: string) => {
    if (!levelId.trim()) return;
    router.push(`/games/${gameId}/levels/${levelId.trim()}`);
  };

  return (
    <main className={styles.main}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Games</h1>
          <p className={styles.meta}>Choose a game to edit levels/configs.</p>
        </div>
      </div>

      <div className={styles.cardGrid}>
        {games.map((g) => (
          <div key={g.id} className={styles.card}>
            <h2>{g.name}</h2>
            <p>{g.description}</p>
            <div className={styles.actionRow}>
              <Link
                href={`/games/${g.id}/levels/demo`}
                className={styles.linkButton}
              >
                Open demo level
              </Link>
            </div>
            <div className={styles.inputRow}>
              <input
                className={styles.input}
                placeholder="Enter levelId…"
                value={levelId}
                onChange={(e) => setLevelId(e.target.value)}
              />
              <button
                className={styles.saveBtn}
                onClick={() => onOpenLevel(g.id)}
              >
                Open level
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
