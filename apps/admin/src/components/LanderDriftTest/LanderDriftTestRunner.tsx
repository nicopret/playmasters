'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type {
  LanderDriftConfigV1,
  LanderDriftTestScenario,
} from '@playmasters/types';
import { LANDER_DRIFT_TEST_SCENARIOS } from '../../../lib/landerDriftTestScenarios';
import styles from './LanderDriftTestRunner.module.css';

type ConfigSource = 'draft' | 'published' | 'defaults';

type TestConfigResponse = {
  source: ConfigSource;
  config: LanderDriftConfigV1;
};

const WIDTH = 760;
const HEIGHT = 420;
const BASELINE_Y = HEIGHT - 50;
const SHIP_SIZE = 34;

type ShipState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fuel: number;
  angle: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const hashSeed = (seed: string): number => {
  let hash = 2166136261;
  for (let idx = 0; idx < seed.length; idx += 1) {
    hash ^= seed.charCodeAt(idx);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createRng = (seed: string) => {
  let state = hashSeed(seed) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const scenarioById = (id: string | null): LanderDriftTestScenario =>
  LANDER_DRIFT_TEST_SCENARIOS.find((item) => item.id === id) ??
  LANDER_DRIFT_TEST_SCENARIOS[0];

export default function LanderDriftTestRunner() {
  const searchParams = useSearchParams();
  const scenario = useMemo(
    () => scenarioById(searchParams.get('scenario')),
    [searchParams],
  );
  const requestedSource = (searchParams.get('configSource') ??
    'defaults') as ConfigSource;
  const effectiveSource: ConfigSource =
    requestedSource === 'draft' || requestedSource === 'published'
      ? requestedSource
      : 'defaults';
  const seed = searchParams.get('seed')?.trim() || scenario.seed;
  const initialScoreOverride = Number(searchParams.get('initialScore') || '');
  const initialFuelOverride = Number(searchParams.get('initialFuel') || '');
  const degradationEnabledOverride = searchParams.get('degradationEnabled');
  const degradationSpeedMultiplier = Number(
    searchParams.get('degradationSpeedMultiplier') || '1',
  );

  const [config, setConfig] = useState<LanderDriftConfigV1 | null>(null);
  const [configSource, setConfigSource] =
    useState<ConfigSource>(effectiveSource);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<
    'loading' | 'ready' | 'landed' | 'crashed'
  >('loading');
  const [score, setScore] = useState(0);
  const [rescuedCount, setRescuedCount] = useState(0);
  const [carriedCount, setCarriedCount] = useState(0);
  const [timeSeconds, setTimeSeconds] = useState(0);
  const [degradationValue, setDegradationValue] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keyRef = useRef({ left: false, right: false, thrust: false });
  const shipRef = useRef<ShipState>({
    x: WIDTH / 2,
    y: 80,
    vx: 0,
    vy: 0,
    fuel: 100,
    angle: 0,
  });
  const targetPointsRef = useRef<
    Array<{ x: number; y: number; active: boolean }>
  >([]);
  const terrainRef = useRef<Array<{ x: number; y: number }>>([]);
  const shipImageRef = useRef<HTMLImageElement | null>(null);
  const elapsedSecondsRef = useRef(0);
  const degradationRef = useRef(0);

  const resetRun = () => {
    const maxFuel = config?.fuel.maxFuel ?? 100;
    shipRef.current = {
      x: WIDTH / 2,
      y: 90,
      vx: 0,
      vy: 0,
      fuel:
        Number.isFinite(initialFuelOverride) && initialFuelOverride > 0
          ? initialFuelOverride
          : (scenario.runtimeOverrides?.initialFuel ?? maxFuel),
      angle: 0,
    };
    const initialScore =
      Number.isFinite(initialScoreOverride) && initialScoreOverride >= 0
        ? initialScoreOverride
        : (scenario.runtimeOverrides?.initialScore ?? 0);
    setScore(initialScore);
    setRescuedCount(0);
    setCarriedCount(0);
    setTimeSeconds(0);
    setDegradationValue(0);
    elapsedSecondsRef.current = 0;
    degradationRef.current = 0;
    setStatus('ready');

    const rng = createRng(seed);
    const points: Array<{ x: number; y: number; active: boolean }> = [];
    for (
      let cluster = 0;
      cluster < scenario.rescueProfile.clusterCount;
      cluster += 1
    ) {
      const centerX = clamp(WIDTH * (0.2 + rng() * 0.6), 70, WIDTH - 70);
      for (let i = 0; i < scenario.rescueProfile.targetsPerCluster; i += 1) {
        points.push({
          x: clamp(centerX + (rng() - 0.5) * 120, 40, WIDTH - 40),
          y: BASELINE_Y - 8,
          active: true,
        });
      }
    }
    targetPointsRef.current = points;

    const terrain: Array<{ x: number; y: number }> = [];
    const step = 18;
    let drift = 0;
    for (let x = 0; x <= WIDTH + step; x += step) {
      drift += (rng() - 0.5) * scenario.terrainProfile.roughness * 10;
      drift = clamp(drift, -28, 28);
      const y = BASELINE_Y - scenario.terrainProfile.amplitude + drift;
      terrain.push({ x, y: clamp(y, BASELINE_Y - 60, BASELINE_Y + 10) });
    }
    terrainRef.current = terrain;
  };

  useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      setLoadError(null);
      setStatus('loading');
      try {
        const res = await fetch(
          `/api/admin/games/lander-drift/test/config?source=${effectiveSource}`,
          { cache: 'no-store' },
        );
        const json = (await res
          .json()
          .catch(() => ({}))) as TestConfigResponse & {
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? 'Failed to resolve config');
        if (cancelled) return;
        setConfigSource(json.source);
        setConfig(json.config);
        if (json.config.ship.publishedUrl) {
          const image = new Image();
          image.src = json.config.ship.publishedUrl;
          image.onload = () => {
            shipImageRef.current = image;
          };
          image.onerror = () => {
            shipImageRef.current = null;
          };
        } else {
          shipImageRef.current = null;
        }
        resetRun();
      } catch (err) {
        if (cancelled) return;
        setLoadError((err as Error).message);
        setStatus('crashed');
      }
    };
    void loadConfig();
    return () => {
      cancelled = true;
    };
  }, [effectiveSource, seed, scenario.id]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') keyRef.current.left = true;
      if (event.key === 'ArrowRight') keyRef.current.right = true;
      if (event.key === 'ArrowUp') keyRef.current.thrust = true;
      if (event.key === 'r' || event.key === 'R') resetRun();
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') keyRef.current.left = false;
      if (event.key === 'ArrowRight') keyRef.current.right = false;
      if (event.key === 'ArrowUp') keyRef.current.thrust = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [scenario.id, config]);

  useEffect(() => {
    if (!config) return;
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    let raf = 0;
    let lastTs = performance.now();
    let carried = 0;
    let rescued = 0;

    const animate = (ts: number) => {
      const dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;
      const ship = shipRef.current;

      if (status === 'ready') {
        elapsedSecondsRef.current += dt;
        setTimeSeconds(elapsedSecondsRef.current);
        const physics = config.ship.physics;
        if (keyRef.current.left) {
          ship.angle = clamp(
            ship.angle - physics.rotationSpeed * dt * 40,
            -70,
            70,
          );
        }
        if (keyRef.current.right) {
          ship.angle = clamp(
            ship.angle + physics.rotationSpeed * dt * 40,
            -70,
            70,
          );
        }

        ship.vy += (9.8 / Math.max(physics.mass, 0.1)) * dt;
        ship.vx *= 1 - clamp(physics.damping * dt, 0, 0.3);
        ship.vy *= 1 - clamp(physics.damping * dt, 0, 0.3);
        if (keyRef.current.thrust && ship.fuel > 0) {
          const rad = (ship.angle * Math.PI) / 180;
          const thrust = physics.thrust * dt;
          ship.vx += Math.sin(rad) * thrust * 0.8;
          ship.vy -= Math.cos(rad) * thrust;
          ship.fuel = Math.max(0, ship.fuel - config.fuel.burnRate * dt);
        } else {
          ship.fuel = Math.max(0, ship.fuel - config.fuel.idleDrainRate * dt);
        }

        ship.x += ship.vx * 45 * dt;
        ship.y += ship.vy * 45 * dt;
        ship.x = clamp(ship.x, SHIP_SIZE / 2, WIDTH - SHIP_SIZE / 2);

        const scenarioDegradationEnabled =
          degradationEnabledOverride === 'on'
            ? true
            : degradationEnabledOverride === 'off'
              ? false
              : scenario.degradationProfile.enabled;
        const speedMul = Number.isFinite(degradationSpeedMultiplier)
          ? Math.max(0, degradationSpeedMultiplier)
          : 1;
        if (
          scenarioDegradationEnabled &&
          elapsedSecondsRef.current >
            scenario.degradationProfile.startAfterSeconds
        ) {
          degradationRef.current = Math.min(
            1,
            degradationRef.current +
              dt * scenario.degradationProfile.speed * speedMul * 0.08,
          );
          setDegradationValue(degradationRef.current);
        }

        const pickupRadius = 16;
        targetPointsRef.current.forEach((target) => {
          if (!target.active) return;
          const dx = ship.x - target.x;
          const dy = ship.y - target.y;
          if (Math.sqrt(dx * dx + dy * dy) <= pickupRadius) {
            target.active = false;
            carried += 1;
            rescued += 1;
            setCarriedCount(carried);
            setRescuedCount(rescued);
          }
        });

        if (ship.y >= BASELINE_Y) {
          ship.y = BASELINE_Y;
          const safe =
            ship.vy <= config.landing.safeVerticalSpeed &&
            Math.abs(ship.angle) <= config.landing.maxTiltDegrees;
          if (!safe) {
            setStatus('crashed');
          } else {
            const atBank = Math.abs(ship.x - WIDTH / 2) <= 48;
            if (atBank && carried > 0) {
              setScore((value) => value + carried * 500);
              carried = 0;
              setCarriedCount(0);
            }
            setStatus('landed');
          }
        }
      }

      context.clearRect(0, 0, WIDTH, HEIGHT);
      const sky = context.createLinearGradient(0, 0, 0, HEIGHT);
      sky.addColorStop(0, '#020617');
      sky.addColorStop(1, '#1e293b');
      context.fillStyle = sky;
      context.fillRect(0, 0, WIDTH, HEIGHT);

      const visibilityHeight =
        scenario.terrainProfile.visibilityRadius +
        Math.abs(shipRef.current.y - BASELINE_Y);
      context.globalAlpha = clamp(visibilityHeight / 500, 0.18, 0.7);
      context.fillStyle = '#cbd5e1';
      context.fillRect(0, 0, WIDTH, BASELINE_Y + 20);
      context.globalAlpha = 1;

      const terrain = terrainRef.current;
      context.beginPath();
      context.moveTo(0, HEIGHT);
      terrain.forEach((point) => {
        const degradedY = point.y + degradationRef.current * 22;
        context.lineTo(point.x, degradedY);
      });
      context.lineTo(WIDTH, HEIGHT);
      context.closePath();
      context.fillStyle = '#334155';
      context.fill();

      context.fillStyle = '#dbeafe';
      context.fillRect(WIDTH / 2 - 50, BASELINE_Y - 4, 100, 6);

      targetPointsRef.current.forEach((target) => {
        if (!target.active) return;
        context.fillStyle = '#22c55e';
        context.beginPath();
        context.arc(target.x, target.y - 4, 4, 0, Math.PI * 2);
        context.fill();
      });

      context.save();
      context.translate(ship.x, ship.y);
      context.rotate((ship.angle * Math.PI) / 180);
      if (shipImageRef.current) {
        context.drawImage(
          shipImageRef.current,
          -SHIP_SIZE / 2,
          -SHIP_SIZE / 2,
          SHIP_SIZE,
          SHIP_SIZE,
        );
      } else {
        context.fillStyle = '#f8fafc';
        context.beginPath();
        context.moveTo(0, -SHIP_SIZE / 2);
        context.lineTo(SHIP_SIZE / 2.4, SHIP_SIZE / 2);
        context.lineTo(-SHIP_SIZE / 2.4, SHIP_SIZE / 2);
        context.closePath();
        context.fill();
      }
      if (status === 'ready' && keyRef.current.thrust && ship.fuel > 0) {
        context.fillStyle = '#fb923c';
        context.beginPath();
        context.moveTo(-5, SHIP_SIZE / 2 - 2);
        context.lineTo(0, SHIP_SIZE / 2 + 12);
        context.lineTo(5, SHIP_SIZE / 2 - 2);
        context.closePath();
        context.fill();
      }
      context.restore();

      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [
    config,
    scenario,
    seed,
    status,
    degradationEnabledOverride,
    degradationSpeedMultiplier,
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div>
          <h2 className={styles.title}>Admin Test Mode</h2>
          <p className={styles.meta}>
            Scenario: {scenario.title} | Config source: {configSource}
          </p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={resetRun}>
            Reset Run
          </button>
          <Link href="/games/lander-drift/test" className={styles.secondary}>
            Back to Setup
          </Link>
        </div>
      </div>

      {loadError ? (
        <div className={styles.error}>Error: {loadError}</div>
      ) : null}

      <div className={styles.layout}>
        <div className={styles.stageWrap}>
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            className={styles.canvas}
          />
        </div>
        <aside className={styles.diagnostics}>
          <h3>Diagnostics</h3>
          <ul>
            <li>Status: {status}</li>
            <li>Fuel: {Math.round(shipRef.current.fuel)}</li>
            <li>Carried Survivors: {carriedCount}</li>
            <li>Rescued Survivors: {rescuedCount}</li>
            <li>Score: {score}</li>
            <li>Scenario: {scenario.id}</li>
            <li>Seed: {seed}</li>
            <li>Degradation: {(degradationValue * 100).toFixed(1)}%</li>
            <li>Elapsed: {timeSeconds.toFixed(1)}s</li>
            <li>Thrust: {config?.ship.physics.thrust ?? '-'}</li>
            <li>Rotation Speed: {config?.ship.physics.rotationSpeed ?? '-'}</li>
            <li>Damping: {config?.ship.physics.damping ?? '-'}</li>
            <li>Landing VSpeed: {config?.landing.safeVerticalSpeed ?? '-'}</li>
            <li>Max Tilt: {config?.landing.maxTiltDegrees ?? '-'}</li>
          </ul>
          <p className={styles.meta}>
            Score submission is disabled in admin test mode.
          </p>
        </aside>
      </div>
    </div>
  );
}
