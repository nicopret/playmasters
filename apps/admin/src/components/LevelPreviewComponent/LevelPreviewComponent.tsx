'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import styles from './LevelPreviewComponent.module.css';

type PreviewShip = {
  enemyId: string;
  label: string;
  iconUrl?: string;
  hitboxWidth: number;
  hitboxHeight: number;
  hp?: number;
  canShoot?: boolean;
  gridCol?: number;
  gridRow?: number;
  gridWidthCells?: number;
  gridHeightCells?: number;
};

type PlayerShipPreview = {
  label: string;
  iconUrl?: string;
  hitboxWidth: number;
  hitboxHeight: number;
};

type LevelPreviewComponentProps = {
  title?: string;
  backgroundUrl?: string;
  ships: PreviewShip[];
  playerShip: PlayerShipPreview;
  settings: {
    fleetSpeed?: number;
    rampFactor?: number;
    descendStep?: number;
    maxConcurrentDivers?: number;
    maxConcurrentShots?: number;
    attackTickMs?: number;
    diveChancePerTick?: number;
    divePattern?: 'straight' | 'sine' | 'track';
    turnRate?: number;
    fireTickMs?: number;
    fireChancePerTick?: number;
  };
  children: ReactNode;
};

const shortLabel = (value: string): string => value.slice(0, 1).toUpperCase();
const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const PLAYFIELD_WIDTH = 800;
const PLAYFIELD_HEIGHT = 450;
const HUD_HEIGHT = 0;
const FORMATION_TOP = HUD_HEIGHT;
const FORMATION_HEIGHT = 364;
const PLAYER_ZONE_TOP = FORMATION_TOP + FORMATION_HEIGHT;
const GRID_COLUMNS = 10;
const GRID_ROWS = 5;
const GRID_COLUMN_WIDTH = 70;
const GRID_ROW_HEIGHT = FORMATION_HEIGHT / GRID_ROWS;
const GRID_LEFT = (PLAYFIELD_WIDTH - GRID_COLUMNS * GRID_COLUMN_WIDTH) / 2;
const DEFAULT_HITBOX = 28;
const PLAYER_SPEED_PX_PER_SEC = 320;
const SHOT_SPEED_PX_PER_SEC = 230;
const PLAYER_SHOT_SPEED_PX_PER_SEC = 340;
const PLAYER_FIRE_INTERVAL_MS = 140;
const DIVE_SPEED_PX_PER_SEC = 140;
const FLEET_SPEED_SCALE = 28;
const TURN_RATE_SCALE = 60;
const DIVE_SWAY = 38;
const EXPLOSION_DURATION_MS = 260;
const MIN_PLAYER_FIRE_SFX_MS = 60;
const MIN_ENEMY_FIRE_SFX_MS = 80;
const MIN_EXPLOSION_SFX_MS = 70;
const MIN_PLAYER_HIT_SFX_MS = 140;

type Diver = {
  id: string;
  sourceKey: string;
  sourceIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  iconUrl?: string;
  label: string;
  ageMs: number;
  homeX: number;
};

type Shot = {
  id: string;
  x: number;
  y: number;
};

type Explosion = {
  id: string;
  x: number;
  y: number;
  until: number;
};

export default function LevelPreviewComponent({
  title = 'Level Config',
  backgroundUrl,
  ships,
  playerShip,
  settings,
  children,
}: LevelPreviewComponentProps) {
  const formationShips = useMemo(() => ships.slice(0, 50), [ships]);
  const [isRunning, setIsRunning] = useState(false);
  const [fleetOffsetX, setFleetOffsetX] = useState(0);
  const [fleetOffsetY, setFleetOffsetY] = useState(0);
  const [divers, setDivers] = useState<Diver[]>([]);
  const [defeatedFormationKeys, setDefeatedFormationKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [shipHpByKey, setShipHpByKey] = useState<Record<string, number>>({});
  const [shots, setShots] = useState<Shot[]>([]);
  const [playerShots, setPlayerShots] = useState<Shot[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [playerX, setPlayerX] = useState(PLAYFIELD_WIDTH / 2 - DEFAULT_HITBOX / 2);
  const [playerHitUntil, setPlayerHitUntil] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const pressedKeysRef = useRef<{ left: boolean; right: boolean; fire: boolean }>({
    left: false,
    right: false,
    fire: false,
  });
  const fleetOffsetXRef = useRef(0);
  const fleetOffsetYRef = useRef(0);
  const fleetDirectionRef = useRef<1 | -1>(1);
  const playerXRef = useRef(PLAYFIELD_WIDTH / 2 - DEFAULT_HITBOX / 2);
  const rngSeedRef = useRef(1);
  const indexedFormationRef = useRef<
    { key: string; left: number; top: number; width: number; height: number; iconUrl?: string; label: string; column: number; index: number }[]
  >([]);
  const activeFormationSpritesRef = useRef<
    { key: string; left: number; top: number; width: number; height: number; iconUrl?: string; label: string; column: number; canShoot: boolean }[]
  >([]);
  const diversRef = useRef<Diver[]>([]);
  const playerShotsRef = useRef<Shot[]>([]);
  const defeatedFormationKeysRef = useRef<Set<string>>(new Set());
  const shipHpByKeyRef = useRef<Record<string, number>>({});
  const attackAccumRef = useRef(0);
  const fireAccumRef = useRef(0);
  const playerFireAccumRef = useRef(0);
  const lastFrameTimeRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const shotSeqRef = useRef(0);
  const explosionSeqRef = useRef(0);
  const diverSeqRef = useRef(0);
  const fleetTimeRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const lastPlayerFireSfxRef = useRef(0);
  const lastEnemyFireSfxRef = useRef(0);
  const lastExplosionSfxRef = useRef(0);
  const lastPlayerHitSfxRef = useRef(0);
  const prevShotsCountRef = useRef(0);
  const prevExplosionsCountRef = useRef(0);
  const prevPlayerHitUntilRef = useRef(0);

  const ensureAudioReady = () => {
    if (typeof window === 'undefined' || !soundEnabled) return;
    if (!audioCtxRef.current) {
      const context = new window.AudioContext();
      const master = context.createGain();
      master.gain.value = 0.2;
      master.connect(context.destination);
      audioCtxRef.current = context;
      masterGainRef.current = master;
    }
    if (audioCtxRef.current.state === 'suspended') {
      void audioCtxRef.current.resume();
    }
  };

  const playTone = (
    frequency: number,
    durationSec: number,
    type: OscillatorType,
    gainValue: number,
    slideToFrequency?: number,
  ) => {
    if (!soundEnabled) return;
    ensureAudioReady();
    const context = audioCtxRef.current;
    const master = masterGainRef.current;
    if (!context || !master) return;

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slideToFrequency != null) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(1, slideToFrequency),
        now + durationSec,
      );
    }
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(gainValue, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
    oscillator.connect(gainNode);
    gainNode.connect(master);
    oscillator.start(now);
    oscillator.stop(now + durationSec + 0.01);
  };

  const tryPlayPlayerFireSfx = () => {
    const now = Date.now();
    if (now - lastPlayerFireSfxRef.current < MIN_PLAYER_FIRE_SFX_MS) return;
    lastPlayerFireSfxRef.current = now;
    playTone(560, 0.07, 'square', 0.13, 760);
  };

  const tryPlayEnemyFireSfx = () => {
    const now = Date.now();
    if (now - lastEnemyFireSfxRef.current < MIN_ENEMY_FIRE_SFX_MS) return;
    lastEnemyFireSfxRef.current = now;
    playTone(320, 0.08, 'sawtooth', 0.08, 220);
  };

  const tryPlayExplosionSfx = () => {
    const now = Date.now();
    if (now - lastExplosionSfxRef.current < MIN_EXPLOSION_SFX_MS) return;
    lastExplosionSfxRef.current = now;
    playTone(210, 0.18, 'triangle', 0.15, 70);
  };

  const tryPlayPlayerHitSfx = () => {
    const now = Date.now();
    if (now - lastPlayerHitSfxRef.current < MIN_PLAYER_HIT_SFX_MS) return;
    lastPlayerHitSfxRef.current = now;
    playTone(180, 0.12, 'square', 0.14, 120);
  };

  const formationSprites = useMemo<{ key: string; left: number; top: number; width: number; height: number; hp: number; iconUrl?: string; label: string; column: number; canShoot: boolean }[]>(() => {
    return formationShips.map((ship, index) => {
      const row = ship.gridRow ?? Math.floor(index / GRID_COLUMNS);
      const col = ship.gridCol ?? (index % GRID_COLUMNS);
      const spanW = clamp(Math.floor(ship.gridWidthCells ?? 1), 1, 2);
      const spanH = clamp(Math.floor(ship.gridHeightCells ?? 1), 1, 2);
      const xCenter = GRID_LEFT + col * GRID_COLUMN_WIDTH + (spanW * GRID_COLUMN_WIDTH) / 2;
      const yCenter = FORMATION_TOP + row * GRID_ROW_HEIGHT + (spanH * GRID_ROW_HEIGHT) / 2;
      const minWidth = spanW * GRID_COLUMN_WIDTH - 8;
      const minHeight = spanH * GRID_ROW_HEIGHT - 8;
      const width = clamp(Math.max(ship.hitboxWidth || DEFAULT_HITBOX, minWidth), 8, 140);
      const height = clamp(
        Math.max(ship.hitboxHeight || DEFAULT_HITBOX, minHeight),
        8,
        140,
      );
      const left = clamp(xCenter - width / 2, 0, PLAYFIELD_WIDTH - width);
      const top = clamp(yCenter - height / 2, FORMATION_TOP, PLAYER_ZONE_TOP - height);
      return {
        key: `${ship.enemyId}-${index}`,
        left,
        top,
        width,
        height,
        hp: Math.max(1, Math.floor(ship.hp ?? 1)),
        iconUrl: ship.iconUrl,
        label: ship.label,
        column: col,
        canShoot: ship.canShoot !== false,
      };
    });
  }, [formationShips]);

  const hiddenFormationKeys = useMemo(() => {
    const hidden = new Set<string>(defeatedFormationKeys);
    divers.forEach((diver) => hidden.add(diver.sourceKey));
    return hidden;
  }, [defeatedFormationKeys, divers]);

  const activeFormationSprites = useMemo(
    () =>
      formationSprites.filter((ship) => !hiddenFormationKeys.has(ship.key)).map((ship) => ({
        ...ship,
        left: clamp(ship.left + fleetOffsetX, 0, PLAYFIELD_WIDTH - ship.width),
        top: clamp(
          ship.top + fleetOffsetY,
          FORMATION_TOP,
          PLAYER_ZONE_TOP - ship.height,
        ),
      })),
    [formationSprites, hiddenFormationKeys, fleetOffsetX, fleetOffsetY],
  );

  const indexedFormation = useMemo(
    () =>
      formationSprites.map((ship, index) => ({
        ...ship,
        index,
      })),
    [formationSprites],
  );

  useEffect(() => {
    indexedFormationRef.current = indexedFormation;
  }, [indexedFormation]);

  useEffect(() => {
    activeFormationSpritesRef.current = activeFormationSprites;
  }, [activeFormationSprites]);

  useEffect(() => {
    diversRef.current = divers;
  }, [divers]);

  useEffect(() => {
    playerShotsRef.current = playerShots;
  }, [playerShots]);

  useEffect(() => {
    defeatedFormationKeysRef.current = defeatedFormationKeys;
  }, [defeatedFormationKeys]);

  useEffect(() => {
    shipHpByKeyRef.current = shipHpByKey;
  }, [shipHpByKey]);

  const playerSprite = useMemo(() => {
    const width = clamp(playerShip.hitboxWidth || DEFAULT_HITBOX, 8, 96);
    const height = clamp(playerShip.hitboxHeight || DEFAULT_HITBOX, 8, 96);
    const xCenter = playerX + width / 2;
    const yCenter = PLAYER_ZONE_TOP + (PLAYFIELD_HEIGHT - PLAYER_ZONE_TOP) / 2;
    return {
      left: clamp(xCenter - width / 2, 0, PLAYFIELD_WIDTH - width),
      top: clamp(yCenter - height / 2, PLAYER_ZONE_TOP, PLAYFIELD_HEIGHT - height),
      width,
      height,
    };
  }, [playerShip.hitboxHeight, playerShip.hitboxWidth, playerX]);

  useEffect(() => {
    const defaultX = PLAYFIELD_WIDTH / 2 - clamp(playerShip.hitboxWidth || DEFAULT_HITBOX, 8, 96) / 2;
    setPlayerX(defaultX);
    playerXRef.current = defaultX;
  }, [playerShip.hitboxWidth]);

  const resetSimulation = () => {
    const initialHpByKey: Record<string, number> = {};
    formationSprites.forEach((ship) => {
      initialHpByKey[ship.key] = ship.hp;
    });
    attackAccumRef.current = 0;
    fireAccumRef.current = 0;
    playerFireAccumRef.current = PLAYER_FIRE_INTERVAL_MS;
    lastFrameTimeRef.current = null;
    fleetTimeRef.current = 0;
    setFleetOffsetX(0);
    fleetOffsetXRef.current = 0;
    setFleetOffsetY(0);
    fleetOffsetYRef.current = 0;
    fleetDirectionRef.current = 1;
    setDivers([]);
    setDefeatedFormationKeys(new Set());
    defeatedFormationKeysRef.current = new Set();
    setShipHpByKey(initialHpByKey);
    shipHpByKeyRef.current = initialHpByKey;
    setShots([]);
    setPlayerShots([]);
    playerShotsRef.current = [];
    setExplosions([]);
    setPlayerHitUntil(0);
    rngSeedRef.current = (rngSeedRef.current + 101) % 2147483647 || 1;
    const width = clamp(playerShip.hitboxWidth || DEFAULT_HITBOX, 8, 96);
    const resetX = PLAYFIELD_WIDTH / 2 - width / 2;
    setPlayerX(resetX);
    playerXRef.current = resetX;
  };

  useEffect(() => {
    resetSimulation();
    setIsRunning(false);
  }, [ships, settings, playerShip.hitboxWidth, playerShip.hitboxHeight]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        pressedKeysRef.current.left = true;
      }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        pressedKeysRef.current.right = true;
      }
      if (event.key === ' ' || event.key === 'Spacebar') {
        ensureAudioReady();
        pressedKeysRef.current.fire = true;
        event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        pressedKeysRef.current.left = false;
      }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        pressedKeysRef.current.right = false;
      }
      if (event.key === ' ' || event.key === 'Spacebar') {
        pressedKeysRef.current.fire = false;
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (shots.length > prevShotsCountRef.current) {
      tryPlayEnemyFireSfx();
    }
    prevShotsCountRef.current = shots.length;
  }, [shots.length]);

  useEffect(() => {
    if (explosions.length > prevExplosionsCountRef.current) {
      tryPlayExplosionSfx();
    }
    prevExplosionsCountRef.current = explosions.length;
  }, [explosions.length]);

  useEffect(() => {
    if (playerHitUntil > prevPlayerHitUntilRef.current) {
      tryPlayPlayerHitSfx();
    }
    prevPlayerHitUntilRef.current = playerHitUntil;
  }, [playerHitUntil]);

  useEffect(() => {
    if (!isRunning) {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      return;
    }

    const rand = () => {
      rngSeedRef.current = (rngSeedRef.current * 48271) % 2147483647;
      return rngSeedRef.current / 2147483647;
    };

    const tick = (now: number) => {
      const last = lastFrameTimeRef.current ?? now;
      const dtMs = Math.max(0, now - last);
      lastFrameTimeRef.current = now;
      const dtSec = dtMs / 1000;
      const speedBase = Math.max(0, settings.fleetSpeed ?? 0) * FLEET_SPEED_SCALE;
      const ramp = Math.max(0, settings.rampFactor ?? 0);
      const fleetBoost = 1 + ramp * Math.min(1.5, fleetTimeRef.current / 60000);
      const fleetSpeed = speedBase * fleetBoost;
      fleetTimeRef.current += dtMs;

      setPlayerX((prev) => {
        const width = clamp(playerShip.hitboxWidth || DEFAULT_HITBOX, 8, 96);
        const moveDir = Number(pressedKeysRef.current.right) - Number(pressedKeysRef.current.left);
        const next = clamp(
          prev + moveDir * PLAYER_SPEED_PX_PER_SEC * dtSec,
          0,
          PLAYFIELD_WIDTH - width,
        );
        playerXRef.current = next;
        return next;
      });

      setFleetOffsetX((prevX) => {
        if (!formationSprites.length || fleetSpeed <= 0) return prevX;
        let nextX = prevX + fleetDirectionRef.current * fleetSpeed * dtSec;
        const leftBound = Math.min(...formationSprites.map((ship) => ship.left + nextX));
        const rightBound = Math.max(
          ...formationSprites.map((ship) => ship.left + ship.width + nextX),
        );
        if (leftBound <= 0 || rightBound >= PLAYFIELD_WIDTH) {
          nextX = prevX;
          fleetDirectionRef.current = fleetDirectionRef.current === 1 ? -1 : 1;
          setFleetOffsetY((prevY) =>
            {
              const nextY = clamp(
              prevY + Math.max(0, settings.descendStep ?? 0),
              0,
              PLAYER_ZONE_TOP - FORMATION_TOP - DEFAULT_HITBOX,
              );
              fleetOffsetYRef.current = nextY;
              return nextY;
            },
          );
        }
        fleetOffsetXRef.current = nextX;
        return nextX;
      });

      setDivers((prevDivers) => {
        const playerWidth = clamp(playerShip.hitboxWidth || DEFAULT_HITBOX, 8, 96);
        const playerCenter = playerXRef.current + playerWidth / 2;
        const turnRate = Math.max(0, settings.turnRate ?? 0) * TURN_RATE_SCALE;
        const pattern = settings.divePattern ?? 'straight';
        return prevDivers
          .map((diver) => {
            const ageMs = diver.ageMs + dtMs;
            let x = diver.x;
            const y = diver.y + DIVE_SPEED_PX_PER_SEC * dtSec;
            if (pattern === 'sine') {
              x = diver.homeX + Math.sin(ageMs / 280) * DIVE_SWAY;
            } else if (pattern === 'track') {
              const delta = playerCenter - (x + diver.width / 2);
              const step = Math.sign(delta) * Math.min(Math.abs(delta), turnRate * dtSec);
              x += step;
            }
            return {
              ...diver,
              ageMs,
              x: clamp(x, 0, PLAYFIELD_WIDTH - diver.width),
              y,
            };
          })
          .filter((diver) => diver.y <= PLAYFIELD_HEIGHT + diver.height);
      });

      setShots((prevShots) => {
        const next = prevShots
          .map((shot) => ({ ...shot, y: shot.y + SHOT_SPEED_PX_PER_SEC * dtSec }))
          .filter((shot) => shot.y <= PLAYFIELD_HEIGHT + 20);
        const playerWidth = clamp(playerShip.hitboxWidth || DEFAULT_HITBOX, 8, 96);
        const playerHeight = clamp(playerShip.hitboxHeight || DEFAULT_HITBOX, 8, 96);
        const playerTop =
          PLAYER_ZONE_TOP + (PLAYFIELD_HEIGHT - PLAYER_ZONE_TOP) / 2 - playerHeight / 2;
        const playerBottom = playerTop + playerHeight;
        const playerLeft = playerXRef.current;
        const playerRight = playerLeft + playerWidth;
        const hit = next.some(
          (shot) =>
            shot.y >= playerTop &&
            shot.y <= playerBottom &&
            shot.x >= playerLeft &&
            shot.x <= playerRight,
        );
        if (hit) {
          setPlayerHitUntil(Date.now() + 180);
        }
        return next.filter(
          (shot) =>
            !(
              shot.y >= playerTop &&
              shot.y <= playerBottom &&
              shot.x >= playerLeft &&
              shot.x <= playerRight
            ),
        );
      });

      attackAccumRef.current += dtMs;
      fireAccumRef.current += dtMs;
      playerFireAccumRef.current += dtMs;

      const attackTickMs = Math.max(1, settings.attackTickMs ?? 1000);
      if (attackAccumRef.current >= attackTickMs) {
        attackAccumRef.current %= attackTickMs;
        const maxDivers = Math.max(0, settings.maxConcurrentDivers ?? 0);
        const diveChance = clamp(settings.diveChancePerTick ?? 0, 0, 1);
        if (maxDivers > 0 && diveChance > 0) {
          setDivers((prevDivers) => {
            if (prevDivers.length >= maxDivers) return prevDivers;
            if (rand() > diveChance) return prevDivers;
            const busy = new Set(prevDivers.map((d) => d.sourceKey));
            const available = indexedFormationRef.current.filter(
              (ship) =>
                !busy.has(ship.key) && !defeatedFormationKeysRef.current.has(ship.key),
            );
            if (!available.length) return prevDivers;
            const pick = available[Math.floor(rand() * available.length)];
            if (!pick) return prevDivers;
            const x = clamp(
              pick.left + fleetOffsetXRef.current,
              0,
              PLAYFIELD_WIDTH - pick.width,
            );
            const y = clamp(
              pick.top + fleetOffsetYRef.current,
              FORMATION_TOP,
              PLAYER_ZONE_TOP - pick.height,
            );
            diverSeqRef.current += 1;
            return [
              ...prevDivers,
              {
                id: `diver-${diverSeqRef.current}`,
                sourceKey: pick.key,
                sourceIndex: pick.index,
                x,
                y,
                width: pick.width,
                height: pick.height,
                iconUrl: pick.iconUrl,
                label: pick.label,
                ageMs: 0,
                homeX: x,
              },
            ];
          });
        }
      }

      const fireTickMs = Math.max(1, settings.fireTickMs ?? 1000);
      if (fireAccumRef.current >= fireTickMs) {
        fireAccumRef.current %= fireTickMs;
        const maxShots = Math.max(0, settings.maxConcurrentShots ?? 0);
        const fireChance = clamp(settings.fireChancePerTick ?? 0, 0, 1);
        if (maxShots > 0 && fireChance > 0) {
          setShots((prevShots) => {
            if (prevShots.length >= maxShots || rand() > fireChance) return prevShots;
            const sources = activeFormationSpritesRef.current.filter(
              (ship) => ship.canShoot !== false,
            );
            if (!sources.length) return prevShots;
            const byColumn = new Map<number, (typeof sources)[number]>();
            sources.forEach((ship) => {
              const existing = byColumn.get(ship.column);
              if (!existing || ship.top > existing.top) {
                byColumn.set(ship.column, ship);
              }
            });
            const candidates = Array.from(byColumn.values());
            if (!candidates.length) return prevShots;
            const shooter = candidates[Math.floor(rand() * candidates.length)];
            if (!shooter) return prevShots;
            shotSeqRef.current += 1;
            return [
              ...prevShots,
              {
                id: `shot-${shotSeqRef.current}`,
                x: shooter.left + shooter.width / 2,
                y: shooter.top + shooter.height,
              },
            ];
          });
        }
      }

      if (pressedKeysRef.current.fire && playerFireAccumRef.current >= PLAYER_FIRE_INTERVAL_MS) {
        playerFireAccumRef.current %= PLAYER_FIRE_INTERVAL_MS;
        shotSeqRef.current += 1;
        const playerWidth = clamp(playerShip.hitboxWidth || DEFAULT_HITBOX, 8, 96);
        const playerHeight = clamp(playerShip.hitboxHeight || DEFAULT_HITBOX, 8, 96);
        const playerTop =
          PLAYER_ZONE_TOP + (PLAYFIELD_HEIGHT - PLAYER_ZONE_TOP) / 2 - playerHeight / 2;
        const nextShot: Shot = {
          id: `player-shot-${shotSeqRef.current}`,
          x: playerXRef.current + playerWidth / 2,
          y: playerTop,
        };
        const appendedPlayerShots = [...playerShotsRef.current, nextShot];
        playerShotsRef.current = appendedPlayerShots;
        setPlayerShots(appendedPlayerShots);
        tryPlayPlayerFireSfx();
      }

      const nowTs = Date.now();
      const movedShots = playerShotsRef.current
        .map((shot) => ({ ...shot, y: shot.y - PLAYER_SHOT_SPEED_PX_PER_SEC * dtSec }))
        .filter((shot) => shot.y >= -20);

      const nextDefeated = new Set<string>(defeatedFormationKeysRef.current);
      const nextHpByKey: Record<string, number> = { ...shipHpByKeyRef.current };
      const hitDiverIds = new Set<string>();
      const hitShots = new Set<string>();
      const spawnedExplosions: Explosion[] = [];
      const activeDivers = diversRef.current;
      const activeFormation = activeFormationSpritesRef.current;

      movedShots.forEach((shot) => {
        const diverHit = activeDivers.find(
          (diver) =>
            shot.x >= diver.x &&
            shot.x <= diver.x + diver.width &&
            shot.y >= diver.y &&
            shot.y <= diver.y + diver.height,
        );
        if (diverHit) {
          const currentHp = Math.max(0, nextHpByKey[diverHit.sourceKey] ?? 1);
          const remainingHp = Math.max(0, currentHp - 1);
          nextHpByKey[diverHit.sourceKey] = remainingHp;
          hitShots.add(shot.id);
          if (remainingHp <= 0) {
            hitDiverIds.add(diverHit.id);
            nextDefeated.add(diverHit.sourceKey);
            explosionSeqRef.current += 1;
            spawnedExplosions.push({
              id: `explosion-${nowTs}-${explosionSeqRef.current}`,
              x: diverHit.x + diverHit.width / 2,
              y: diverHit.y + diverHit.height / 2,
              until: nowTs + EXPLOSION_DURATION_MS,
            });
          }
          return;
        }
        const formationHit = activeFormation.find(
          (ship) =>
            shot.x >= ship.left &&
            shot.x <= ship.left + ship.width &&
            shot.y >= ship.top &&
            shot.y <= ship.top + ship.height,
        );
        if (formationHit) {
          const currentHp = Math.max(0, nextHpByKey[formationHit.key] ?? 1);
          const remainingHp = Math.max(0, currentHp - 1);
          nextHpByKey[formationHit.key] = remainingHp;
          hitShots.add(shot.id);
          if (remainingHp <= 0) {
            nextDefeated.add(formationHit.key);
            explosionSeqRef.current += 1;
            spawnedExplosions.push({
              id: `explosion-${nowTs}-${explosionSeqRef.current}`,
              x: formationHit.left + formationHit.width / 2,
              y: formationHit.top + formationHit.height / 2,
              until: nowTs + EXPLOSION_DURATION_MS,
            });
          }
        }
      });

      shipHpByKeyRef.current = nextHpByKey;
      setShipHpByKey(nextHpByKey);
      if (nextDefeated.size !== defeatedFormationKeysRef.current.size) {
        defeatedFormationKeysRef.current = nextDefeated;
        setDefeatedFormationKeys(nextDefeated);
      }
      if (hitDiverIds.size > 0) {
        setDivers((prevDivers) => prevDivers.filter((diver) => !hitDiverIds.has(diver.id)));
      }

      const nextPlayerShots = movedShots.filter((shot) => !hitShots.has(shot.id));
      playerShotsRef.current = nextPlayerShots;
      setPlayerShots(nextPlayerShots);
      setExplosions((prev) => {
        const active = prev.filter((explosion) => explosion.until > nowTs);
        return spawnedExplosions.length > 0 ? [...active, ...spawnedExplosions] : active;
      });

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = null;
      lastFrameTimeRef.current = null;
    };
  }, [
    isRunning,
    settings,
    formationSprites,
    playerShip.hitboxWidth,
    playerShip.hitboxHeight,
  ]);

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <h3>{title}</h3>
        <div className={styles.playbar}>
          <button
            type="button"
            className={styles.playButton}
            onClick={() => {
              ensureAudioReady();
              setIsRunning((running) => !running);
            }}
          >
            {isRunning ? 'Pause' : 'Play Test'}
          </button>
          <button
            type="button"
            className={styles.ghostButton}
            onClick={() => setSoundEnabled((enabled) => !enabled)}
          >
            {soundEnabled ? 'Sound On' : 'Sound Off'}
          </button>
          <button
            type="button"
            className={styles.ghostButton}
            onClick={resetSimulation}
          >
            Reset
          </button>
        </div>
      </header>
      <div className={styles.content}>
        <div className={styles.previewPane}>
          <div className={styles.previewFrame}>
            {backgroundUrl ? (
              <img
                src={backgroundUrl}
                alt="Level background preview"
                className={styles.backgroundImage}
              />
            ) : null}
            <div className={styles.zoneHud} />
            <div className={styles.zoneFormation} />
            <div className={styles.zonePlayer} />
            <div className={styles.columnGuides}>
              {Array.from({ length: GRID_COLUMNS }, (_, idx) => (
                <div key={idx} className={styles.columnGuide} />
              ))}
            </div>

            {formationSprites.length === 0 ? (
              <div className={styles.emptyState}>Add ships to preview formation</div>
            ) : null}
            {activeFormationSprites.map((ship) => (
              <div
                key={ship.key}
                className={styles.shipSlot}
                title={ship.label}
                style={{
                  left: `${ship.left}px`,
                  top: `${ship.top}px`,
                  width: `${ship.width}px`,
                  height: `${ship.height}px`,
                }}
              >
                {ship.iconUrl ? (
                  <img src={ship.iconUrl} alt={ship.label} className={styles.shipIcon} />
                ) : (
                  <span className={styles.shipFallback}>{shortLabel(ship.label)}</span>
                )}
              </div>
            ))}
            {divers.map((diver) => (
              <div
                key={diver.id}
                className={styles.diverSlot}
                title={`Diving: ${diver.label}`}
                style={{
                  left: `${diver.x}px`,
                  top: `${diver.y}px`,
                  width: `${diver.width}px`,
                  height: `${diver.height}px`,
                }}
              >
                {diver.iconUrl ? (
                  <img src={diver.iconUrl} alt={diver.label} className={styles.shipIcon} />
                ) : (
                  <span className={styles.shipFallback}>{shortLabel(diver.label)}</span>
                )}
              </div>
            ))}
            {shots.map((shot) => (
              <span
                key={shot.id}
                className={styles.enemyShot}
                style={{ left: `${shot.x}px`, top: `${shot.y}px` }}
              />
            ))}
            {playerShots.map((shot) => (
              <span
                key={shot.id}
                className={styles.playerShot}
                style={{ left: `${shot.x}px`, top: `${shot.y}px` }}
              />
            ))}
            {explosions.map((explosion) => (
              <span
                key={explosion.id}
                className={styles.explosion}
                style={{ left: `${explosion.x}px`, top: `${explosion.y}px` }}
              />
            ))}

            <div
              className={`${styles.playerSlot} ${
                playerHitUntil > Date.now() ? styles.playerHit : ''
              }`}
              title={playerShip.label}
              style={{
                left: `${playerSprite.left}px`,
                top: `${playerSprite.top}px`,
                width: `${playerSprite.width}px`,
                height: `${playerSprite.height}px`,
              }}
            >
              {playerShip.iconUrl ? (
                <img
                  src={playerShip.iconUrl}
                  alt={playerShip.label}
                  className={styles.shipIcon}
                />
              ) : (
                <span className={styles.shipFallback}>{shortLabel(playerShip.label)}</span>
              )}
            </div>
            <div className={styles.simHint}>
              Move: Arrow keys / A-D | Fire: Space
            </div>
          </div>
        </div>
        <div className={styles.fieldsPane}>{children}</div>
      </div>
    </section>
  );
}
