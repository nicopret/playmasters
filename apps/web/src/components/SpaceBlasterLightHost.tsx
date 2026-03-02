'use client';

import { useMemo } from 'react';
import LevelPreviewComponent from '../../../admin/src/components/LevelPreviewComponent/LevelPreviewComponent';

type RuntimeBundle = {
  levelConfigs?: Array<{
    backgroundUrl?: string;
    formationGrid?: {
      placements?: Array<{
        enemyId?: string;
        col?: number;
        row?: number;
        width?: number;
        height?: number;
      }>;
    };
    waves?: Array<{ enemyId?: string; count?: number }>;
    speed?: number;
    fleetSpeedRamp?: { maxMultiplier?: number };
    descendStep?: number;
    maxConcurrentShots?: number;
    diveScheduler?: {
      attackTickMs?: number;
      diveChancePerTick?: number;
      maxConcurrentDivers?: number;
    };
    diveMotion?: {
      divePattern?: 'straight' | 'sine' | 'track';
      turnRate?: number;
    };
    shooting?: number;
  }>;
  enemyCatalog?: {
    entries?: Array<{
      enemyId?: string;
      spriteUrl?: string;
      spriteKey?: string;
      hp?: number;
      canShoot?: boolean;
    }>;
  };
  heroCatalog?: {
    entries?: Array<{
      spriteUrl?: string;
      spriteKey?: string;
      hitbox?: { width?: number; height?: number };
    }>;
  };
};

type Props = {
  bundle: RuntimeBundle;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const FLEET_SPEED_SCALE = 28;

export default function SpaceBlasterLightHost({ bundle }: Props) {
  const level = bundle.levelConfigs?.[0] ?? {};

  const ships = useMemo(() => {
    const enemyById = new Map(
      (bundle.enemyCatalog?.entries ?? [])
        .filter((entry) => typeof entry.enemyId === 'string' && entry.enemyId)
        .map((entry) => [entry.enemyId as string, entry]),
    );

    const placements = level.formationGrid?.placements ?? [];
    if (placements.length > 0) {
      return placements.map((placement, idx) => {
        const enemyId = `${placement.enemyId ?? 'enemy_grunt'}`;
        const enemy = enemyById.get(enemyId);
        return {
          enemyId,
          label: enemyId,
          iconUrl: enemy?.spriteUrl ?? enemy?.spriteKey,
          hitboxWidth: 28,
          hitboxHeight: 28,
          hp: Math.max(1, Math.floor(enemy?.hp ?? 1)),
          canShoot: enemy?.canShoot === true,
          gridCol: clamp(Math.floor(Number(placement.col ?? idx % 10)), 0, 9),
          gridRow: clamp(Math.floor(Number(placement.row ?? Math.floor(idx / 10))), 0, 4),
          gridWidthCells: clamp(Math.floor(Number(placement.width ?? 1)), 1, 2),
          gridHeightCells: clamp(Math.floor(Number(placement.height ?? 1)), 1, 2),
        };
      });
    }

    const expanded: Array<{
      enemyId: string;
      label: string;
      iconUrl?: string;
      hitboxWidth: number;
      hitboxHeight: number;
      hp: number;
      canShoot: boolean;
      gridCol: number;
      gridRow: number;
      gridWidthCells: number;
      gridHeightCells: number;
    }> = [];
    let index = 0;
    (level.waves ?? []).forEach((wave) => {
      const enemyId = `${wave.enemyId ?? 'enemy_grunt'}`;
      const enemy = enemyById.get(enemyId);
      const count = clamp(Math.floor(Number(wave.count ?? 0)), 0, 50);
      for (let i = 0; i < count; i += 1) {
        expanded.push({
          enemyId,
          label: enemyId,
          iconUrl: enemy?.spriteUrl ?? enemy?.spriteKey,
          hitboxWidth: 28,
          hitboxHeight: 28,
          hp: Math.max(1, Math.floor(enemy?.hp ?? 1)),
          canShoot: enemy?.canShoot === true,
          gridCol: index % 10,
          gridRow: Math.floor(index / 10),
          gridWidthCells: 1,
          gridHeightCells: 1,
        });
        index += 1;
      }
    });
    return expanded;
  }, [bundle.enemyCatalog?.entries, level.formationGrid?.placements, level.waves]);

  const playerShip = useMemo(() => {
    const hero = bundle.heroCatalog?.entries?.[0];
    return {
      label: 'Player Ship',
      iconUrl: hero?.spriteUrl ?? hero?.spriteKey,
      hitboxWidth: clamp(Math.floor(Number(hero?.hitbox?.width ?? 28)), 8, 96),
      hitboxHeight: clamp(Math.floor(Number(hero?.hitbox?.height ?? 28)), 8, 96),
    };
  }, [bundle.heroCatalog?.entries]);

  const settings = useMemo(() => {
    const fireTickMs = 1000;
    const shootingPercent = clamp(Number(level.shooting ?? 0), 0, 100);
    const fireChancePerTick = clamp(
      (shootingPercent / 100) / (1000 / fireTickMs),
      0,
      1,
    );
    return {
      fleetSpeed: Math.max(0, Number(level.speed ?? 0) / FLEET_SPEED_SCALE),
      rampFactor: Math.max(0, Number(level.fleetSpeedRamp?.maxMultiplier ?? 1) - 1),
      descendStep: Math.max(0, Number(level.descendStep ?? 0)),
      maxConcurrentDivers: Math.max(0, Math.floor(Number(level.diveScheduler?.maxConcurrentDivers ?? 0))),
      maxConcurrentShots: Math.max(0, Math.floor(Number(level.maxConcurrentShots ?? 6))),
      attackTickMs: Math.max(1, Number(level.diveScheduler?.attackTickMs ?? 1000)),
      diveChancePerTick: clamp(Number(level.diveScheduler?.diveChancePerTick ?? 0), 0, 1),
      divePattern: (level.diveMotion?.divePattern ?? 'straight') as 'straight' | 'sine' | 'track',
      turnRate: Math.max(0, Number(level.diveMotion?.turnRate ?? 0)),
      fireTickMs,
      fireChancePerTick,
    };
  }, [
    level.descendStep,
    level.diveMotion?.divePattern,
    level.diveMotion?.turnRate,
    level.diveScheduler?.attackTickMs,
    level.diveScheduler?.diveChancePerTick,
    level.diveScheduler?.maxConcurrentDivers,
    level.fleetSpeedRamp?.maxMultiplier,
    level.maxConcurrentShots,
    level.shooting,
    level.speed,
  ]);

  return (
    <LevelPreviewComponent
      title="Space Blaster"
      backgroundUrl={level.backgroundUrl}
      ships={ships}
      playerShip={playerShip}
      settings={settings}
    >
      <></>
    </LevelPreviewComponent>
  );
}
