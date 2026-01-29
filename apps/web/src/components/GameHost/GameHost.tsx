'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card } from '@playmasters/ui';
import { createGameSdk, type GameSdk } from '@playmasters/game-sdk';
import type { EmbeddedGame } from '@playmasters/types';
import styles from './GameHost.module.css';

type Props = {
  gameId: string;
  gameTitle: string;
  realtimeWsUrl: string;
  apiBaseUrl?: string;
  countryCode?: string;
  user?: {
    id: string;
    displayName?: string | null;
  };
};

type MountedGame = { destroy: () => void };

const gameLoaders: Record<string, () => Promise<EmbeddedGame>> = {
  'space-blaster': async () => (await import('@playmasters/space-blaster')).spaceBlaster,
  'game-space-blaster': async () => (await import('@playmasters/space-blaster')).spaceBlaster,
};

const createGuestSdk = (): GameSdk => ({
  async startRun() {
    throw new Error('auth_required');
  },
  async submitScore() {
    throw new Error('auth_required');
  },
});

export const GameHost = ({
  gameId,
  gameTitle,
  realtimeWsUrl,
  apiBaseUrl = '',
  countryCode,
  user,
}: Props) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<MountedGame | null>(null);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [lastScore, setLastScore] = useState<number | null>(null);

  const loader = useMemo(() => gameLoaders[gameId], [gameId]);
  const displayName = user?.displayName ?? user?.id ?? 'Guest';

  useEffect(() => {
    let cancelled = false;

    const mount = async () => {
      const el = mountRef.current;
      if (!el) return;

      if (!loader) {
        setStatus('error');
        setMessage('Game module not found.');
        return;
      }

      setStatus('loading');
      setMessage(user ? 'Loading game...' : 'Guest mode: sign in to submit scores');

      try {
        const game = await loader();
        if (cancelled) return;

        const sdk: GameSdk = user
          ? createGameSdk({
              gameId,
              user: { id: user.id, displayName },
              realtimeWsUrl,
              apiBaseUrl,
              countryCode,
            })
          : createGuestSdk();

        gameRef.current?.destroy();
        gameRef.current = game.mount({
          el,
          sdk,
          onReady: () => {
            if (!cancelled) setStatus('ready');
          },
          onGameOver: (finalScore) => {
            if (cancelled) return;
            setLastScore(finalScore);
            if (!user) {
              setMessage('Sign in to submit your score to the leaderboard.');
            } else {
              setMessage('Run finished - check the leaderboard for your spot.');
            }
          },
        });
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setMessage((err as Error).message ?? 'Failed to load game');
      }
    };

    mount();

    return () => {
      cancelled = true;
      gameRef.current?.destroy();
      gameRef.current = null;
    };
  }, [loader, apiBaseUrl, realtimeWsUrl, user?.id, displayName, gameId, countryCode]);

  useEffect(() => {
    if (status === 'ready') {
      setMessage(
        user
          ? 'Ready to play. Scores submit automatically on game over.'
          : 'Guest mode: play freely, sign in to submit scores.'
      );
    }
  }, [status, user]);

  const statusLabel =
    status === 'ready' ? 'Ready' : status === 'loading' ? 'Loading...' : 'Error loading';

  return (
    <Card className={styles.host} variant="surface" padding="lg">
      <div className={styles.hud}>
        <div className={styles.badges}>
          <span className={`${styles.pill} ${styles.status}`}>
            <span className={`${styles.dot} ${status === 'ready' ? styles.dotOn : styles.dotOff}`} />
            {statusLabel}
          </span>
          <span className={`${styles.pill} ${user ? styles.pillOn : styles.pillOff}`}>
            {user ? `Signed in as ${displayName}` : 'Guest play (scores not submitted)'}
          </span>
        </div>
        <div className={styles.instructions}>
          <span>Move with arrows or A/D.</span>
          <span>Space to shoot, auto-fire enabled.</span>
        </div>
      </div>

      <div className={styles.stage} aria-label={`${gameTitle} stage`}>
        <div ref={mountRef} className={styles.canvas} />
      </div>

      <div className={styles.footer}>
        <div className={styles.meta}>
          <Badge variant="info" size="sm">
            Realtime: {realtimeWsUrl.replace(/^wss?:\/\//, '')}
          </Badge>
          {lastScore !== null ? (
            <span className={styles.score}>Last score: {lastScore}</span>
          ) : (
            <span className={styles.score}>No runs yet</span>
          )}
        </div>
        {!user ? (
          <Button as="a" href="/api/auth/signin" variant="primary" size="sm">
            Sign in
          </Button>
        ) : null}
      </div>

      {message ? <div className={styles.message}>{message}</div> : null}
    </Card>
  );
};
