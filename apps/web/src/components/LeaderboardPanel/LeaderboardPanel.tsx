'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Badge, Button } from '@playmasters/ui';
import type {
  LeaderboardEntry,
  LeaderboardScope,
  LeaderboardState,
  WsServerMessage,
} from '@playmasters/types';
import type { Game } from '../../lib/games';
import styles from './LeaderboardPanel.module.css';

type Props = {
  game: Game;
};

type LeaderboardData = Record<'global' | 'local' | 'personal', LeaderboardEntry[]>;

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
            <tr key={`${entry.userId}-${entry.rank}`} className={styles.row}>
              <td>{entry.rank}</td>
              <td>{entry.displayName}</td>
              <td>{entry.score.toLocaleString()}</td>
              <td>{entry.countryCode ?? '--'}</td>
              <td>{new Date(entry.achievedAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const LeaderboardPanel = ({ game }: Props) => {
  const { data: session } = useSession();
  const [scope, setScope] = useState<LeaderboardScope>('global');
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [data, setData] = useState<LeaderboardData>({
    global: [],
    local: [],
    personal: [],
  });
  const wsRef = useRef<WebSocket | null>(null);

  const countryCode = useMemo(
    () => process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE ?? 'GB',
    []
  );
  const wsUrl = useMemo(
    () => process.env.NEXT_PUBLIC_REALTIME_WS_URL ?? 'ws://localhost:4000',
    []
  );

  const scopes = useMemo<LeaderboardScope[]>(() => {
    const base: LeaderboardScope[] = ['global', 'local'];
    if (session?.user?.id) base.push('personal');
    return base;
  }, [session?.user?.id]);

  const applyState = (state: LeaderboardState) => {
    setData((prev) => {
      if (state.scope === 'global') return { ...prev, global: state.entries };
      if (state.scope === 'local') return { ...prev, local: state.entries };
      return { ...prev, personal: state.entries };
    });
  };

  useEffect(() => {
    let alive = true;
    setStatus('connecting');

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => {
      if (!alive) return;
      setStatus('connected');
      ws.send(
        JSON.stringify({
          type: 'subscribe',
          gameId: game.id,
          scopes,
          countryCode,
          userId: session?.user?.id,
        })
      );
    };

    ws.onmessage = (event) => {
      if (!alive) return;
      try {
        const message = JSON.parse(event.data) as WsServerMessage;
        if (message.type === 'leaderboard:state' || message.type === 'leaderboard:update') {
          applyState(message.payload);
        }
      } catch (err) {
        console.warn('Failed to parse realtime payload', err);
      }
    };

    ws.onerror = () => {
      if (!alive) return;
      setStatus('error');
    };
    ws.onclose = () => {
      if (!alive) return;
      setStatus('error');
    };

    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 20_000);

    return () => {
      alive = false;
      clearInterval(heartbeat);
      ws.close();
      wsRef.current = null;
    };
  }, [game.id, wsUrl, countryCode, scopes, session?.user?.id]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ gameId?: string }>).detail;
      if (detail?.gameId && detail.gameId !== game.id) return;
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'subscribe',
            gameId: game.id,
            scopes,
            countryCode,
            userId: session?.user?.id,
          })
        );
      }
    };

    window.addEventListener('playmasters:refresh-leaderboard', handler as EventListener);
    return () => {
      window.removeEventListener('playmasters:refresh-leaderboard', handler as EventListener);
    };
  }, [game.id, scopes, countryCode, session?.user?.id]);

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

      return <Table entries={data.personal} />;
    }

    if (game.status === 'coming-soon') {
      return <EmptyState message="No scores yet" />;
    }

    return <Table entries={data[scope]} />;
  };

  const statusLabel =
    status === 'connected' ? 'Live' : status === 'connecting' ? 'Connecting...' : 'Offline';

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.status}>
          <span
            className={`${styles.dot} ${status === 'connected' ? styles.dotOn : styles.dotOff}`}
            aria-hidden
          />
          <span>{statusLabel}</span>
        </div>
      </div>

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
