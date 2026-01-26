'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button, Badge } from '@playmasters/ui';
import type { Game } from '../../lib/games';
import type { LeaderboardData, LeaderboardEntry, LeaderboardScope } from '../../lib/mockLeaderboards';
import styles from './LeaderboardPanel.module.css';

type Props = {
  game: Game;
  data: LeaderboardData;
};

const scopeLabels: Record<LeaderboardScope, string> = {
  global: 'Global',
  local: 'Local',
  personal: 'Personal',
};

const EmptyState = ({ message }: { message: string }) => (
  <div className={styles.empty}>{message}</div>
);

const Table = ({ entries }: { entries: LeaderboardEntry[] }) => {
  if (!entries.length) return <EmptyState message="No scores yet" />;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Score</th>
            <th>Country</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.rank} className={styles.row}>
              <td>{entry.rank}</td>
              <td>{entry.player}</td>
              <td>{entry.score.toLocaleString()}</td>
              <td>{entry.country ?? '—'}</td>
              <td>{entry.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const LeaderboardPanel = ({ game, data }: Props) => {
  const [scope, setScope] = useState<LeaderboardScope>('global');
  const { data: session } = useSession();

  const personalEntries =
    session?.user && game.status !== 'coming-soon'
      ? data.personal.length
        ? data.personal
        : [
            {
              rank: 1,
              player: session.user.name ?? session.user.email ?? 'You',
              score: 12345,
              country: '—',
              date: '2026-01-20',
            },
          ]
      : [];

  const renderContent = () => {
    if (scope === 'personal') {
      if (!session?.user) {
        return (
          <div className={styles.personal}>
            <div>Sign in to see your personal best.</div>
            <Button as="a" href="/api/auth/signin" variant="primary" size="sm">
              Sign in
            </Button>
          </div>
        );
      }

      if (!personalEntries.length) {
        return <EmptyState message="No scores yet" />;
      }

      return <Table entries={personalEntries} />;
    }

    const entries = data[scope];
    if (game.status === 'coming-soon') {
      return <EmptyState message="No scores yet" />;
    }

    return <Table entries={entries} />;
  };

  return (
    <div className={styles.panel}>
      <div className={styles.tabs} role="tablist" aria-label="Leaderboard scopes">
        {(['global', 'local', 'personal'] as LeaderboardScope[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`${styles.tab} ${scope === key ? styles.tabActive : ''}`}
            onClick={() => setScope(key)}
            role="tab"
            aria-selected={scope === key}
          >
            {scopeLabels[key]}
            {key !== 'personal' && data[key].length > 0 ? (
              <Badge variant="info" size="sm" className={styles.count}>
                {data[key].length}
              </Badge>
            ) : null}
          </button>
        ))}
      </div>

      {renderContent()}
    </div>
  );
};
