'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './LanderDriftHost.module.css';
import type { LanderDriftConfigV1 } from '@playmasters/types';

type RunState = 'loading' | 'ready' | 'landed' | 'crashed' | 'error';

const WIDTH = 520;
const HEIGHT = 320;
const GROUND_Y = HEIGHT - 36;
const SHIP_SIZE = 32;

type ShipState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fuel: number;
  angleDeg: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export default function LanderDriftHost() {
  const [config, setConfig] = useState<LanderDriftConfigV1 | null>(null);
  const [status, setStatus] = useState<RunState>('loading');
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keyStateRef = useRef({ left: false, right: false, thrust: false });
  const shipRef = useRef<ShipState>({
    x: WIDTH / 2,
    y: 36,
    vx: 0,
    vy: 0,
    fuel: 100,
    angleDeg: 0,
  });
  const imageRef = useRef<HTMLImageElement | null>(null);

  const reset = () => {
    const maxFuel = config?.fuel.maxFuel ?? 100;
    shipRef.current = {
      x: WIDTH / 2,
      y: 36,
      vx: 0,
      vy: 0,
      fuel: maxFuel,
      angleDeg: 0,
    };
    setStatus(config ? 'ready' : 'loading');
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStatus('loading');
      setError(null);
      try {
        const res = await fetch('/api/games/lander-drift/config', {
          cache: 'no-store',
        });
        const json = (await res.json().catch(() => ({}))) as
          | LanderDriftConfigV1
          | { error?: string };
        if (!res.ok) {
          throw new Error(
            (json as { error?: string }).error ?? 'config_failed',
          );
        }
        if (cancelled) return;
        setConfig(json as LanderDriftConfigV1);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message);
        setStatus('error');
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!config?.ship.publishedUrl) {
      imageRef.current = null;
      return;
    }
    const image = new Image();
    image.src = config.ship.publishedUrl;
    image.onload = () => {
      imageRef.current = image;
    };
    image.onerror = () => {
      imageRef.current = null;
    };
  }, [config?.ship.publishedUrl]);

  useEffect(() => {
    if (!config) return;
    reset();
  }, [config]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') keyStateRef.current.left = true;
      if (event.key === 'ArrowRight') keyStateRef.current.right = true;
      if (event.key === 'ArrowUp') keyStateRef.current.thrust = true;
      if (event.key === 'r' || event.key === 'R') reset();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') keyStateRef.current.left = false;
      if (event.key === 'ArrowRight') keyStateRef.current.right = false;
      if (event.key === 'ArrowUp') keyStateRef.current.thrust = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [config]);

  useEffect(() => {
    if (!config) return;
    let frame = 0;
    let lastTs = performance.now();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const tick = (ts: number) => {
      const delta = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;

      const ship = shipRef.current;
      if (status === 'ready') {
        const physics = config.ship.physics;
        const keys = keyStateRef.current;
        if (keys.left) {
          ship.angleDeg = clamp(
            ship.angleDeg - physics.rotationSpeed * delta * 40,
            -60,
            60,
          );
        }
        if (keys.right) {
          ship.angleDeg = clamp(
            ship.angleDeg + physics.rotationSpeed * delta * 40,
            -60,
            60,
          );
        }

        ship.vy += (9.8 / Math.max(0.1, physics.mass)) * delta;
        ship.vx *= 1 - clamp(physics.damping * delta, 0, 0.3);
        ship.vy *= 1 - clamp(physics.damping * delta, 0, 0.3);

        if (keys.thrust && ship.fuel > 0) {
          const thrust = physics.thrust * delta;
          const angleRad = (ship.angleDeg * Math.PI) / 180;
          ship.vx += Math.sin(angleRad) * thrust * 0.8;
          ship.vy -= Math.cos(angleRad) * thrust;
          ship.fuel = Math.max(0, ship.fuel - config.fuel.burnRate * delta);
        } else {
          ship.fuel = Math.max(
            0,
            ship.fuel - config.fuel.idleDrainRate * delta,
          );
        }

        ship.x += ship.vx * 42 * delta;
        ship.y += ship.vy * 42 * delta;
        ship.x = clamp(ship.x, SHIP_SIZE / 2, WIDTH - SHIP_SIZE / 2);

        if (ship.y >= GROUND_Y) {
          ship.y = GROUND_Y;
          const landedSafely =
            ship.vy <= config.landing.safeVerticalSpeed &&
            Math.abs(ship.angleDeg) <= config.landing.maxTiltDegrees;
          setStatus(landedSafely ? 'landed' : 'crashed');
        }
      }

      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      sky.addColorStop(0, '#0f172a');
      sky.addColorStop(1, '#1e293b');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = '#334155';
      ctx.fillRect(0, GROUND_Y + SHIP_SIZE / 2, WIDTH, HEIGHT);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(WIDTH / 2 - 42, GROUND_Y + SHIP_SIZE / 2, 84, 4);

      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate((ship.angleDeg * Math.PI) / 180);
      const shipImage = imageRef.current;
      if (shipImage) {
        ctx.drawImage(
          shipImage,
          -SHIP_SIZE / 2,
          -SHIP_SIZE / 2,
          SHIP_SIZE,
          SHIP_SIZE,
        );
      } else {
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(0, -SHIP_SIZE / 2);
        ctx.lineTo(SHIP_SIZE / 2.2, SHIP_SIZE / 2);
        ctx.lineTo(-SHIP_SIZE / 2.2, SHIP_SIZE / 2);
        ctx.closePath();
        ctx.fill();
      }
      if (keyStateRef.current.thrust && ship.fuel > 0 && status === 'ready') {
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(-6, SHIP_SIZE / 2 - 2);
        ctx.lineTo(0, SHIP_SIZE / 2 + 10 + (frame % 4));
        ctx.lineTo(6, SHIP_SIZE / 2 - 2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      frame += 1;
      requestAnimationFrame(tick);
    };

    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [config, status]);

  const hudLabel = useMemo(() => {
    if (status === 'loading') return 'Loading config...';
    if (status === 'error') return `Error: ${error ?? 'Failed to load'}`;
    if (status === 'landed') return 'Successful landing. Press R to restart.';
    if (status === 'crashed') return 'Crash landing. Press R to retry.';
    return 'Arrow keys to fly. Press R to reset.';
  }, [status, error]);

  const fuelPct = config
    ? Math.round(
        (shipRef.current.fuel / Math.max(config.fuel.maxFuel, 1)) * 100,
      )
    : 0;

  return (
    <div className={styles.root}>
      <div className={styles.hud}>
        <span>{hudLabel}</span>
        <span>Fuel: {fuelPct}%</span>
      </div>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        width={WIDTH}
        height={HEIGHT}
      />
    </div>
  );
}
