'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card } from '@playmasters/ui';
import { createGameSdk, type GameSdk } from '@playmasters/game-sdk';
import type { EmbeddedGame } from '@playmasters/types';
import styles from './GameHost.module.css';
import SpaceBlasterLightHost from '../SpaceBlasterLightHost';
import LanderDriftHost from '../LanderDriftHost/LanderDriftHost';

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
type RuntimeBundleResponse = { bundle?: unknown };
type ConfigHashCarrier = { configHash?: string; versionHash?: string };
type SpaceBlasterRunStateDetail = { gameId?: string; state?: string };

const gameLoaders: Record<string, () => Promise<EmbeddedGame>> = {
  'space-blaster': async () =>
    (await import('@playmasters/space-blaster')).spaceBlaster,
  'game-space-blaster': async () =>
    (await import('@playmasters/space-blaster')).spaceBlaster,
};

const createGuestSdk = (): GameSdk => ({
  isAuthenticated: false,
  async startRun() {
    throw new Error('auth_required');
  },
  async submitScore() {
    throw new Error('auth_required');
  },
});

const SPACE_BLASTER_RUN_STATE_EVENT = 'playmasters:space-blaster-run-state';
const CONFIG_UPDATE_POLL_MS = 30000;
const ACTIVE_RUN_STATES = new Set([
  'COUNTDOWN',
  'PLAYING',
  'PAUSED',
  'PLAYER_RESPAWN',
  'WAVE_CLEAR',
  'LEVEL_COMPLETE',
  'RUN_ENDING',
  'SUBMITTING',
]);

const isSpaceBlasterGame = (gameId: string): boolean =>
  gameId === 'space-blaster' || gameId === 'game-space-blaster';

const isLanderDriftGame = (gameId: string): boolean =>
  gameId === 'lander-drift';

const extractConfigHash = (bundle: unknown): string | undefined => {
  if (!bundle || typeof bundle !== 'object') return undefined;
  const carrier = bundle as ConfigHashCarrier;
  const hash = carrier.configHash ?? carrier.versionHash;
  if (typeof hash !== 'string' || hash.trim().length === 0) return undefined;
  return hash;
};

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

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [message, setMessage] = useState<string | null>(null);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [runtimeBundle, setRuntimeBundle] = useState<unknown>(null);

  const loader = useMemo(() => gameLoaders[gameId], [gameId]);
  const displayName = user?.displayName ?? user?.id ?? 'Guest';
  const mountedConfigHashRef = useRef<string | undefined>(undefined);
  const pendingBundleRef = useRef<unknown>(undefined);
  const pendingBundleHashRef = useRef<string | undefined>(undefined);
  const runStateRef = useRef<string>('BOOT');

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let runStateListener: EventListener | undefined;

    const mount = async () => {
      const el = mountRef.current;
      if (!el && !isSpaceBlasterGame(gameId)) return;

      if (isLanderDriftGame(gameId)) {
        setStatus('ready');
        setMessage(
          'Published config is loaded from /api/games/lander-drift/config.',
        );
        return;
      }

      if (!loader) {
        setStatus('error');
        setMessage('Game module not found.');
        return;
      }

      setStatus('loading');
      setMessage(
        user ? 'Loading game...' : 'Guest mode: sign in to submit scores',
      );

      try {
        const fetchRuntimeBundle = async (): Promise<unknown> => {
          if (!apiBaseUrl) {
            throw new Error(
              'Missing NEXT_PUBLIC_API_BASE_URL for Space Blaster runtime config.',
            );
          }
          const runtimeResp = await fetch(
            `${apiBaseUrl}/api/space-blaster/runtime?env=dev`,
            { cache: 'no-store' },
          );
          if (!runtimeResp.ok) {
            throw new Error(
              `Failed to load runtime config (${runtimeResp.status}).`,
            );
          }
          const runtimePayload =
            (await runtimeResp.json()) as RuntimeBundleResponse;
          return runtimePayload.bundle;
        };

        if (isSpaceBlasterGame(gameId)) {
          const loadBundle = async () => {
            const bundle = await fetchRuntimeBundle();
            if (cancelled) return;
            setRuntimeBundle(bundle);
            setStatus('ready');
          };
          await loadBundle();
          intervalId = setInterval(() => {
            void loadBundle().catch(() => {
              // Keep current bundle if refresh fails.
            });
          }, CONFIG_UPDATE_POLL_MS);
          return;
        }

        if (!el) return;
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

        const mountWithConfig = (resolvedConfig?: unknown) => {
          if (cancelled) return;
          gameRef.current?.destroy();
          mountedConfigHashRef.current = extractConfigHash(resolvedConfig);
          gameRef.current = game.mount({
            el,
            sdk,
            resolvedConfig,
            onReady: () => {
              if (!cancelled) setStatus('ready');
            },
            onGameOver: (finalScore) => {
              if (cancelled) return;
              runStateRef.current = 'RESULTS';
              setLastScore(finalScore);
              if (pendingBundleRef.current) {
                setMessage('Applying latest update for next run...');
                mountWithConfig(pendingBundleRef.current);
                pendingBundleRef.current = undefined;
                pendingBundleHashRef.current = undefined;
                return;
              }
              if (!user) {
                setMessage('Sign in to submit your score to the leaderboard.');
              } else {
                setMessage(
                  'Run finished - check the leaderboard for your spot.',
                );
              }
            },
          });
        };

        const applyPendingWhenSafe = () => {
          const pending = pendingBundleRef.current;
          if (!pending) return;
          if (ACTIVE_RUN_STATES.has(runStateRef.current)) return;
          setMessage('Applying latest update for next run...');
          mountWithConfig(pending);
          pendingBundleRef.current = undefined;
          pendingBundleHashRef.current = undefined;
        };

        mountWithConfig(undefined);

        runStateListener = ((event: Event): void => {
          const custom = event as CustomEvent<SpaceBlasterRunStateDetail>;
          if (custom.detail?.gameId !== gameId) return;
          runStateRef.current = custom.detail.state ?? runStateRef.current;
          applyPendingWhenSafe();
        }) as EventListener;
        window.addEventListener(
          SPACE_BLASTER_RUN_STATE_EVENT,
          runStateListener,
        );
        if (cancelled && runStateListener) {
          window.removeEventListener(
            SPACE_BLASTER_RUN_STATE_EVENT,
            runStateListener,
          );
        }
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setMessage((err as Error).message ?? 'Failed to load game');
      }
    };

    mount();

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (runStateListener) {
        window.removeEventListener(
          SPACE_BLASTER_RUN_STATE_EVENT,
          runStateListener,
        );
      }
      setRuntimeBundle(null);
      pendingBundleRef.current = undefined;
      pendingBundleHashRef.current = undefined;
      mountedConfigHashRef.current = undefined;
      gameRef.current?.destroy();
      gameRef.current = null;
    };
  }, [
    loader,
    apiBaseUrl,
    realtimeWsUrl,
    user?.id,
    displayName,
    gameId,
    countryCode,
  ]);

  useEffect(() => {
    if (status === 'ready') {
      setMessage(
        user
          ? 'Ready to play. Scores submit automatically on game over.'
          : 'Guest mode: play freely, sign in to submit scores.',
      );
    }
  }, [status, user]);

  const statusLabel =
    status === 'ready'
      ? 'Ready'
      : status === 'loading'
        ? 'Loading...'
        : 'Error loading';

  return (
    <Card className={styles.host} variant="surface" padding="lg">
      <div className={styles.hud}>
        <div className={styles.badges}>
          <span className={`${styles.pill} ${styles.status}`}>
            <span
              className={`${styles.dot} ${status === 'ready' ? styles.dotOn : styles.dotOff}`}
            />
            {statusLabel}
          </span>
          <span
            className={`${styles.pill} ${user ? styles.pillOn : styles.pillOff}`}
          >
            {user
              ? `Signed in as ${displayName}`
              : 'Guest play (scores not submitted)'}
          </span>
        </div>
        <div className={styles.instructions}>
          <span>Move with keyboard controls.</span>
          <span>Gameplay bindings depend on the selected game.</span>
        </div>
      </div>

      <div className={styles.stage} aria-label={`${gameTitle} stage`}>
        {isSpaceBlasterGame(gameId) ? (
          <div className={styles.canvas}>
            {runtimeBundle ? (
              <SpaceBlasterLightHost
                bundle={runtimeBundle as Record<string, unknown>}
              />
            ) : null}
          </div>
        ) : isLanderDriftGame(gameId) ? (
          <div className={styles.canvas}>
            <LanderDriftHost />
          </div>
        ) : (
          <div ref={mountRef} className={styles.canvas} />
        )}
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
