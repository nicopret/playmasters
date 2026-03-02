'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import dashStyles from '../../../../../components/AdminDashboard/AdminDashboard.module.css';
import AssetComponent from '../../../../../components/AssetComponent/AssetComponent';
import FormationComponent, { type FormationGrid } from '../../../../../components/FormationComponent/FormationComponent';
import LevelPreviewComponent from '../../../../../components/LevelPreviewComponent/LevelPreviewComponent';
import styles from './page.module.css';
import type {
  CoreAssetDefinition,
  CoreAssetFileRef,
  CoreAssetSpec,
} from '../../../../../lib/coreAssets';

type EnemyOption = {
  enemyId: string;
  displayName?: string;
  hp?: number;
};

type EnemyHitbox = {
  hitboxWidth: number;
  hitboxHeight: number;
};

type PreviewPlayerShip = {
  label: string;
  iconUrl?: string;
  hitboxWidth: number;
  hitboxHeight: number;
};

type WaveEnemy = { enemyId: string; count: number };
type Wave = { enemies: WaveEnemy[]; overrides?: Record<string, unknown> };

type FormationPlacement = {
  id: string;
  enemyId: string;
  col: number;
  row: number;
  width: number;
  height: number;
};

type LevelConfig = {
  gameId: string;
  levelId: string;
  layoutId?: string;
  backgroundAssetId?: string;
  backgroundVersionId?: string;
  pinnedToVersion?: boolean;
  updatedAt?: string;
  waves: Wave[];
  formationGrid: FormationGrid;
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

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Announcements', href: '/announcements' },
  { label: 'Games', href: '/games' },
  { label: 'Assets', href: '/assets' },
];

const FORMATION_COLUMNS = 10;
const FORMATION_ROWS = 5;

const emptyFormationGrid = (): FormationGrid => ({
  columns: FORMATION_COLUMNS,
  rows: FORMATION_ROWS,
  placements: [],
});

const normalizeFormationGrid = (value: unknown): FormationGrid => {
  if (!value || typeof value !== 'object') return emptyFormationGrid();
  const raw = value as {
    columns?: unknown;
    rows?: unknown;
    placements?: unknown;
  };
  const columns =
    typeof raw.columns === 'number' && Number.isFinite(raw.columns) && raw.columns > 0
      ? Math.floor(raw.columns)
      : FORMATION_COLUMNS;
  const rows =
    typeof raw.rows === 'number' && Number.isFinite(raw.rows) && raw.rows > 0
      ? Math.floor(raw.rows)
      : FORMATION_ROWS;
  const placements = Array.isArray(raw.placements)
    ? raw.placements
        .map((entry, index) => {
          if (!entry || typeof entry !== 'object') return null;
          const rawPlacement = entry as Record<string, unknown>;
          const enemyId =
            typeof rawPlacement.enemyId === 'string' ? rawPlacement.enemyId.trim() : '';
          if (!enemyId) return null;
          const col = Number(rawPlacement.col);
          const row = Number(rawPlacement.row);
          const width = Number(rawPlacement.width);
          const height = Number(rawPlacement.height);
          if (
            !Number.isFinite(col) ||
            !Number.isFinite(row) ||
            !Number.isFinite(width) ||
            !Number.isFinite(height)
          ) {
            return null;
          }
          return {
            id:
              typeof rawPlacement.id === 'string' && rawPlacement.id.trim()
                ? rawPlacement.id
                : `placement-${index}`,
            enemyId,
            col: Math.floor(col),
            row: Math.floor(row),
            width: width >= 2 ? 2 : 1,
            height: height >= 2 ? 2 : 1,
          } satisfies FormationPlacement;
        })
        .filter((entry): entry is FormationPlacement => !!entry)
    : [];
  return { columns, rows, placements };
};

const getEnemyCellSize = (
  enemyId: string,
  hitboxes: Record<string, EnemyHitbox>,
  hpById: Record<string, number>,
): { width: 1 | 2; height: 1 | 2 } => {
  const lower = enemyId.toLowerCase();
  if (lower === 'grunt' || lower === 'fast' || lower.endsWith('_grunt') || lower.endsWith('_fast')) {
    return { width: 1, height: 1 };
  }
  if (lower.includes('boss')) return { width: 2, height: 2 };
  const hitbox = hitboxes[enemyId];
  const hp = hpById[enemyId] ?? 1;
  if ((hitbox?.hitboxWidth ?? 0) >= 56 || (hitbox?.hitboxHeight ?? 0) >= 56 || hp >= 12) {
    return { width: 2, height: 2 };
  }
  if ((hitbox?.hitboxWidth ?? 0) >= 40 || (hitbox?.hitboxHeight ?? 0) >= 40 || hp >= 4) {
    return { width: 2, height: 1 };
  }
  return { width: 1, height: 1 };
};

const toWavesFromFormation = (formation: FormationGrid): Wave[] => {
  const counts = new Map<string, number>();
  (formation.placements ?? []).forEach((placement) => {
    const enemyId = `${placement.enemyId ?? ''}`.trim();
    if (!enemyId) return;
    counts.set(enemyId, (counts.get(enemyId) ?? 0) + 1);
  });
  if (counts.size === 0) return [];
  return [
    {
      enemies: Array.from(counts.entries()).map(([enemyId, count]) => ({
        enemyId,
        count,
      })),
    },
  ];
};

const canPlaceFormationPlacement = (
  existingPlacements: FormationPlacement[],
  candidate: FormationPlacement,
): boolean => {
  if (candidate.col < 0 || candidate.row < 0) return false;
  if (candidate.col + candidate.width > FORMATION_COLUMNS) return false;
  if (candidate.row + candidate.height > FORMATION_ROWS) return false;
  return !existingPlacements.some((entry) => {
    const overlapX =
      candidate.col < entry.col + entry.width &&
      candidate.col + candidate.width > entry.col;
    const overlapY =
      candidate.row < entry.row + entry.height &&
      candidate.row + candidate.height > entry.row;
    return overlapX && overlapY;
  });
};

const toFormationFromWaves = (
  waves: Wave[],
  hitboxes: Record<string, EnemyHitbox>,
  hpById: Record<string, number>,
): FormationGrid => {
  const placements: FormationPlacement[] = [];
  let seq = 0;
  const enemyIds: string[] = [];
  waves.forEach((wave) => {
    (wave.enemies ?? []).forEach((enemy) => {
      const count = Number.isFinite(enemy.count) ? Math.max(0, enemy.count) : 0;
      for (let idx = 0; idx < count; idx += 1) {
        enemyIds.push(enemy.enemyId);
      }
    });
  });
  enemyIds.forEach((enemyId) => {
    const size = getEnemyCellSize(enemyId, hitboxes, hpById);
    let placed = false;
    for (let row = 0; row < FORMATION_ROWS && !placed; row += 1) {
      for (let col = 0; col < FORMATION_COLUMNS && !placed; col += 1) {
        const candidate: FormationPlacement = {
          id: `placement-${seq}`,
          enemyId,
          col,
          row,
          width: size.width,
          height: size.height,
        };
        if (!canPlaceFormationPlacement(placements, candidate)) continue;
        placements.push(candidate);
        seq += 1;
        placed = true;
      }
    }
  });
  return {
    columns: FORMATION_COLUMNS,
    rows: FORMATION_ROWS,
    placements,
  };
};

const LEVEL_BACKGROUND_SPEC: CoreAssetSpec = {
  id: 'level.background',
  displayName: 'Level Background',
  kind: 'vfx',
  group: 'VFX',
  slots: [{ slotId: 'image.main', label: 'Background Image', media: 'image' }],
  variables: [],
  fx: [],
};

const createDefaultBackgroundDefinition = (
  levelId: string,
): CoreAssetDefinition => ({
  id: `${levelId}.background`,
  displayName: `Level ${levelId} Background`,
  kind: 'vfx',
  slots: [{ slotId: 'image.main', label: 'Background Image', media: 'image' }],
  variables: {},
  fx: {},
});

const getAssetFileUrl = (
  gameId: string,
  file: CoreAssetFileRef | undefined,
): string | undefined => {
  if (!file) return undefined;
  if (file.inlineDataUrl) return file.inlineDataUrl;
  if (file.objectKey) {
    return `/api/games/${gameId}/assets/file?key=${encodeURIComponent(file.objectKey)}`;
  }
  return undefined;
};

export default function LevelConfigPage() {
  const { gameId, levelId } = useParams<{ gameId: string; levelId: string }>();
  if (!gameId || !levelId) {
    return <div className={styles.page}>Missing route parameters</div>;
  }
  const [enemies, setEnemies] = useState<EnemyOption[]>([]);
  const [enemyIcons, setEnemyIcons] = useState<Record<string, string>>({});
  const [enemyHitboxes, setEnemyHitboxes] = useState<Record<string, EnemyHitbox>>(
    {},
  );
  const [enemyHpById, setEnemyHpById] = useState<Record<string, number>>({});
  const [playerShip, setPlayerShip] = useState<PreviewPlayerShip>({
    label: 'Player Ship',
    hitboxWidth: 28,
    hitboxHeight: 28,
  });
  const [backgroundDefinition, setBackgroundDefinition] =
    useState<CoreAssetDefinition>(() => createDefaultBackgroundDefinition(levelId));
  const [uploadingBackgroundSlotId, setUploadingBackgroundSlotId] = useState<
    string | null
  >(null);
  const [config, setConfig] = useState<LevelConfig>({
    gameId,
    levelId,
    waves: [],
    formationGrid: emptyFormationGrid(),
    fleetSpeed: 0,
    rampFactor: 0,
    descendStep: 0,
    maxConcurrentDivers: 0,
    maxConcurrentShots: 0,
    attackTickMs: 1000,
    diveChancePerTick: 0,
    divePattern: 'straight',
    turnRate: 0,
    fireTickMs: 1000,
    fireChancePerTick: 0,
  });
  const [originalKnobs, setOriginalKnobs] = useState<Pick<
    LevelConfig,
    | 'fleetSpeed'
    | 'rampFactor'
    | 'descendStep'
    | 'maxConcurrentDivers'
    | 'maxConcurrentShots'
    | 'attackTickMs'
    | 'diveChancePerTick'
    | 'divePattern'
    | 'turnRate'
    | 'fireTickMs'
    | 'fireChancePerTick'
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const knobPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knobPersistRequestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [cfgRes, enemyRes, backgroundAssetRes, assetsRes] =
          await Promise.all([
          fetch(`/api/games/${gameId}/levels/${levelId}`),
          fetch(`/api/catalog/enemies?gameId=${encodeURIComponent(gameId)}`),
          fetch(`/api/games/${gameId}/levels/${levelId}/background-asset`),
          fetch(`/api/games/${gameId}/assets`, { cache: 'no-store' }),
        ]);
        if (!cfgRes.ok) throw new Error('Failed to load level');
        if (!enemyRes.ok) throw new Error('Failed to load enemies');
        if (!backgroundAssetRes.ok) {
          throw new Error('Failed to load level background asset');
        }
        if (!assetsRes.ok) throw new Error('Failed to load game assets')
        const cfgJson = await cfgRes.json();
        const enemyJson = await enemyRes.json();
        const backgroundAssetJson = await backgroundAssetRes.json();
        const assetsJson = await assetsRes.json();
        if (!cancelled) {
          const readPositiveNumber = (
            value: unknown,
            fallback: number,
            min = 1,
            max = 128,
          ): number => {
            if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
            return Math.min(max, Math.max(min, value));
          };

          const cfgData =
            cfgJson.config ??
            ({
              gameId,
              levelId,
              waves: [],
              formationGrid: emptyFormationGrid(),
              fleetSpeed: 0,
              rampFactor: 0,
              descendStep: 0,
              maxConcurrentDivers: 0,
              maxConcurrentShots: 0,
              attackTickMs: 1000,
              diveChancePerTick: 0,
              divePattern: 'straight',
              turnRate: 0,
              fireTickMs: 1000,
              fireChancePerTick: 0,
            } as LevelConfig);
          setConfig({
            ...cfgData,
            waves: Array.isArray(cfgData.waves) ? cfgData.waves : [],
            formationGrid: normalizeFormationGrid((cfgData as any).formationGrid),
            fleetSpeed: cfgData.fleetSpeed ?? 0,
            rampFactor: cfgData.rampFactor ?? 0,
            descendStep: cfgData.descendStep ?? 0,
            maxConcurrentDivers: cfgData.maxConcurrentDivers ?? 0,
            maxConcurrentShots: cfgData.maxConcurrentShots ?? 0,
            attackTickMs: cfgData.attackTickMs ?? 1000,
            diveChancePerTick: cfgData.diveChancePerTick ?? 0,
            divePattern: (cfgData.divePattern as any) ?? 'straight',
            turnRate: cfgData.turnRate ?? 0,
            fireTickMs: cfgData.fireTickMs ?? 1000,
            fireChancePerTick: cfgData.fireChancePerTick ?? 0,
          });
          setOriginalKnobs({
            fleetSpeed: cfgData.fleetSpeed ?? 0,
            rampFactor: cfgData.rampFactor ?? 0,
            descendStep: cfgData.descendStep ?? 0,
            maxConcurrentDivers: cfgData.maxConcurrentDivers ?? 0,
            maxConcurrentShots: cfgData.maxConcurrentShots ?? 0,
            attackTickMs: cfgData.attackTickMs ?? 1000,
            diveChancePerTick: cfgData.diveChancePerTick ?? 0,
            divePattern: (cfgData.divePattern as any) ?? 'straight',
            turnRate: cfgData.turnRate ?? 0,
            fireTickMs: cfgData.fireTickMs ?? 1000,
            fireChancePerTick: cfgData.fireChancePerTick ?? 0,
          });
          const definitions = Array.isArray(assetsJson?.draft?.definitions)
            ? assetsJson.draft.definitions
            : [];
          const draftEnemyOptions: EnemyOption[] = definitions
            .filter(
              (definition: CoreAssetDefinition) => definition.kind === 'enemy',
            )
            .map((definition: CoreAssetDefinition) => ({
              enemyId: definition.id.replace(/^enemy\./, ''),
              displayName:
                definition.displayName ?? definition.id.replace(/^enemy\./, ''),
            }));
          const catalogEnemyOptions: EnemyOption[] = Array.isArray(
            enemyJson.enemies,
          )
            ? enemyJson.enemies
            : [];
          const mergedEnemyMap = new Map<string, EnemyOption>();
          draftEnemyOptions.forEach((enemy) =>
            mergedEnemyMap.set(enemy.enemyId, enemy),
          );
          catalogEnemyOptions.forEach((enemy) =>
            mergedEnemyMap.set(enemy.enemyId, {
              enemyId: enemy.enemyId,
              displayName: enemy.displayName ?? enemy.enemyId,
            }),
          );
          setEnemies(Array.from(mergedEnemyMap.values()));
          const nextEnemyIcons: Record<string, string> = {};
          const nextEnemyHitboxes: Record<string, EnemyHitbox> = {};
          const nextEnemyHp: Record<string, number> = {};
          let nextPlayerShip: PreviewPlayerShip = {
            label: 'Player Ship',
            hitboxWidth: 28,
            hitboxHeight: 28,
          };
          definitions.forEach((definition: CoreAssetDefinition) => {
            if (definition.id === 'hero.playerShip') {
              const playerSpriteSlot = definition.slots.find(
                (slot) => slot.slotId === 'spriteKey' && slot.media === 'image',
              );
              const playerFile = playerSpriteSlot?.file;
              let iconUrl: string | undefined;
              if (playerFile?.inlineDataUrl) {
                iconUrl = playerFile.inlineDataUrl;
              } else if (playerFile?.objectKey) {
                iconUrl = `/api/games/${gameId}/assets/file?key=${encodeURIComponent(playerFile.objectKey)}`;
              }
              nextPlayerShip = {
                label: definition.displayName ?? 'Player Ship',
                iconUrl,
                hitboxWidth: readPositiveNumber(
                  definition.variables?.hitboxWidth,
                  28,
                ),
                hitboxHeight: readPositiveNumber(
                  definition.variables?.hitboxHeight,
                  28,
                ),
              };
              return;
            }
            if (definition.kind !== 'enemy') return;
            const enemyId = definition.id.replace(/^enemy\./, '');
            nextEnemyHitboxes[enemyId] = {
              hitboxWidth: readPositiveNumber(
                definition.variables?.hitboxWidth,
                28,
              ),
              hitboxHeight: readPositiveNumber(
                definition.variables?.hitboxHeight,
                28,
              ),
            };
            nextEnemyHp[enemyId] = readPositiveNumber(definition.variables?.hp, 1, 1, 999);
            const spriteSlot = definition.slots.find(
              (slot) => slot.slotId === 'spriteKey' && slot.media === 'image',
            );
            const file = spriteSlot?.file;
            if (!file) return;
            if (file.inlineDataUrl) {
              nextEnemyIcons[enemyId] = file.inlineDataUrl;
              return;
            }
            if (file.objectKey) {
              nextEnemyIcons[enemyId] =
                `/api/games/${gameId}/assets/file?key=${encodeURIComponent(file.objectKey)}`;
            }
          });
          catalogEnemyOptions.forEach((enemy) => {
            if (nextEnemyHp[enemy.enemyId]) return;
            if (typeof enemy.hp === 'number' && Number.isFinite(enemy.hp) && enemy.hp > 0) {
              nextEnemyHp[enemy.enemyId] = Math.floor(enemy.hp);
            }
          });
          setEnemyIcons(nextEnemyIcons);
          setEnemyHitboxes(nextEnemyHitboxes);
          setEnemyHpById(nextEnemyHp);
          setPlayerShip(nextPlayerShip);
          setBackgroundDefinition(
            (backgroundAssetJson.definition as CoreAssetDefinition) ??
              createDefaultBackgroundDefinition(levelId),
          );
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Load failed');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [gameId, levelId]);

  const previewBackgroundUrl = useMemo(() => {
    const backgroundFile = backgroundDefinition.slots.find(
      (slot) => slot.slotId === 'image.main',
    )?.file;
    return getAssetFileUrl(gameId, backgroundFile);
  }, [backgroundDefinition, gameId]);

  const enemyCellSizes = useMemo(() => {
    const map: Record<string, { width: 1 | 2; height: 1 | 2 }> = {};
    enemies.forEach((enemy) => {
      map[enemy.enemyId] = getEnemyCellSize(enemy.enemyId, enemyHitboxes, enemyHpById);
    });
    return map;
  }, [enemies, enemyHitboxes, enemyHpById]);

  useEffect(() => {
    const hasFormationShips = (config.formationGrid?.placements ?? []).length > 0;
    if (hasFormationShips || (config.waves ?? []).length === 0) return;
    setConfig((current) => {
      if ((current.formationGrid?.placements ?? []).length > 0) return current;
      return {
        ...current,
        formationGrid: toFormationFromWaves(
          current.waves ?? [],
          enemyHitboxes,
          enemyHpById,
        ),
      };
    });
  }, [config.formationGrid?.placements, config.waves, enemyHitboxes, enemyHpById]);

  const previewShips = useMemo(() => {
    const placements = config.formationGrid?.placements ?? [];
    if (placements.length > 0) {
      return placements.map((placement) => ({
        enemyId: placement.enemyId,
        label:
          enemies.find((enemy) => enemy.enemyId === placement.enemyId)?.displayName ??
          placement.enemyId,
        iconUrl: enemyIcons[placement.enemyId],
        hitboxWidth: enemyHitboxes[placement.enemyId]?.hitboxWidth ?? 28,
        hitboxHeight: enemyHitboxes[placement.enemyId]?.hitboxHeight ?? 28,
        hp:
          enemyHpById[placement.enemyId] ??
          enemies.find((enemy) => enemy.enemyId === placement.enemyId)?.hp ??
          1,
        gridCol: placement.col,
        gridRow: placement.row,
        gridWidthCells: placement.width,
        gridHeightCells: placement.height,
      }));
    }
    const expandedEnemyIds: string[] = [];
    (config.waves ?? []).forEach((wave) => {
      (wave.enemies ?? []).forEach((enemy) => {
        const count = Number.isFinite(enemy.count) ? Math.max(0, enemy.count) : 0;
        for (let idx = 0; idx < count; idx += 1) {
          expandedEnemyIds.push(enemy.enemyId);
        }
      });
    });
    return expandedEnemyIds.map((enemyId) => ({
      enemyId,
      label:
        enemies.find((enemy) => enemy.enemyId === enemyId)?.displayName ?? enemyId,
      iconUrl: enemyIcons[enemyId],
      hitboxWidth: enemyHitboxes[enemyId]?.hitboxWidth ?? 28,
      hitboxHeight: enemyHitboxes[enemyId]?.hitboxHeight ?? 28,
      hp: enemyHpById[enemyId] ?? enemies.find((enemy) => enemy.enemyId === enemyId)?.hp ?? 1,
    }));
  }, [config.formationGrid?.placements, config.waves, enemies, enemyIcons, enemyHitboxes, enemyHpById]);

  const knobErrors: Partial<Record<keyof LevelConfig, string>> = {};
  if ((config.fleetSpeed ?? 0) < 0) knobErrors.fleetSpeed = 'Must be >= 0';
  if ((config.rampFactor ?? 0) < 0 || (config.rampFactor ?? 0) > 1)
    knobErrors.rampFactor = 'Must be between 0 and 1';
  if ((config.descendStep ?? 0) < 0) knobErrors.descendStep = 'Must be >= 0';
  if ((config.maxConcurrentDivers ?? 0) < 0)
    knobErrors.maxConcurrentDivers = 'Must be >= 0';
  if ((config.maxConcurrentShots ?? 0) < 0)
    knobErrors.maxConcurrentShots = 'Must be >= 0';
  if ((config.attackTickMs ?? 0) < 1)
    knobErrors.attackTickMs = 'Must be at least 1 ms';
  if (
    (config.diveChancePerTick ?? 0) < 0 ||
    (config.diveChancePerTick ?? 0) > 1
  )
    knobErrors.diveChancePerTick = 'Must be between 0 and 1';
  if (
    config.divePattern &&
    !['straight', 'sine', 'track'].includes(config.divePattern)
  )
    knobErrors.divePattern = 'Invalid pattern';
  const trackingEnabled = config.divePattern === 'track';
  const MAX_TURN_RATE = 10;
  if (trackingEnabled) {
    if ((config.turnRate ?? 0) < 0 || (config.turnRate ?? 0) > MAX_TURN_RATE) {
      knobErrors.turnRate = `Must be between 0 and ${MAX_TURN_RATE}`;
    }
  }
  if ((config.fireTickMs ?? 0) < 1)
    knobErrors.fireTickMs = 'Must be at least 1 ms';
  if (
    (config.fireChancePerTick ?? 0) < 0 ||
    (config.fireChancePerTick ?? 0) > 1
  )
    knobErrors.fireChancePerTick = 'Must be between 0 and 1';

  const knobChanged =
    originalKnobs &&
    [
      'fleetSpeed',
      'rampFactor',
      'descendStep',
      'maxConcurrentDivers',
      'maxConcurrentShots',
    ].some((k) => (config as any)[k] !== (originalKnobs as any)[k]);
  const diveKnobChanged =
    originalKnobs &&
    [
      'attackTickMs',
      'diveChancePerTick',
      'divePattern',
      'turnRate',
      'maxConcurrentDivers',
    ].some((k) => (config as any)[k] !== (originalKnobs as any)[k]);
  const shootKnobChanged =
    originalKnobs &&
    ['fireTickMs', 'fireChancePerTick', 'maxConcurrentShots'].some(
      (k) => (config as any)[k] !== (originalKnobs as any)[k],
    );

  const persistBackgroundDefinition = async (definition: CoreAssetDefinition) => {
    const res = await fetch(
      `/api/games/${gameId}/levels/${levelId}/background-asset`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ definition }),
      },
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error ?? 'Failed to save level background asset');
    }
  };

  const uploadBackgroundSlot = async (
    slotId: string,
    media: 'image' | 'audio',
    file: File,
  ) => {
    setUploadingBackgroundSlotId(slotId);
    try {
      const definitionId = `${levelId}.background`;
      const form = new FormData();
      form.set('definitionId', definitionId);
      form.set('slotId', slotId);
      form.set('media', media);
      form.set('file', file);

      const res = await fetch(`/api/games/${gameId}/assets/upload`, {
        method: 'POST',
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? 'Upload failed');
      }

      const uploadedFile = json.file as CoreAssetFileRef;
      const nextDefinition: CoreAssetDefinition = {
        ...backgroundDefinition,
        slots: backgroundDefinition.slots.map((slot) =>
          slot.slotId === slotId ? { ...slot, file: uploadedFile } : slot,
        ),
      };

      await persistBackgroundDefinition(nextDefinition);
      setBackgroundDefinition(nextDefinition);
      setConfig((current) => ({
        ...current,
        backgroundAssetId: definitionId,
        backgroundVersionId: undefined,
        pinnedToVersion: false,
      }));
      setError(null);
    } finally {
      setUploadingBackgroundSlotId(null);
    }
  };

  const persistLevelConfig = async (nextConfig: LevelConfig) => {
    const res = await fetch(`/api/games/${gameId}/levels/${levelId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        layoutId: nextConfig.layoutId,
        backgroundAssetId: nextConfig.backgroundAssetId,
        backgroundVersionId: undefined,
        pinToVersion: false,
        fleetSpeed: nextConfig.fleetSpeed,
        rampFactor: nextConfig.rampFactor,
        descendStep: nextConfig.descendStep,
        maxConcurrentDivers: nextConfig.maxConcurrentDivers,
        maxConcurrentShots: nextConfig.maxConcurrentShots,
        waves: nextConfig.waves,
        formationGrid: nextConfig.formationGrid,
        attackTickMs: nextConfig.attackTickMs,
        diveChancePerTick: nextConfig.diveChancePerTick,
        divePattern: nextConfig.divePattern,
        turnRate: nextConfig.turnRate,
        fireTickMs: nextConfig.fireTickMs,
        fireChancePerTick: nextConfig.fireChancePerTick,
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || 'Save failed');
    }
    const json = await res.json();
    const saved = json.config as LevelConfig;
    return {
      ...saved,
      waves: Array.isArray(saved.waves) ? saved.waves : [],
      formationGrid: normalizeFormationGrid((saved as any).formationGrid),
    };
  };

  const scheduleKnobPersist = (nextConfig: LevelConfig) => {
    if (knobPersistTimerRef.current) {
      clearTimeout(knobPersistTimerRef.current);
    }

    const requestId = ++knobPersistRequestIdRef.current;
    knobPersistTimerRef.current = setTimeout(() => {
      void persistLevelConfig(nextConfig)
        .then((savedConfig) => {
          if (requestId !== knobPersistRequestIdRef.current) return;
          setConfig(savedConfig);
          setSavedAt(new Date().toLocaleTimeString());
          setError(null);
        })
        .catch((err) => {
          if (requestId !== knobPersistRequestIdRef.current) return;
          setError((err as Error).message);
        });
    }, 450);
  };

  const updateKnob = <K extends keyof LevelConfig>(
    key: K,
    value: LevelConfig[K],
  ) => {
    setConfig((current) => {
      const nextConfig: LevelConfig = {
        ...current,
        [key]: value,
      };
      scheduleKnobPersist(nextConfig);
      return nextConfig;
    });
  };

  useEffect(
    () => () => {
      if (knobPersistTimerRef.current) {
        clearTimeout(knobPersistTimerRef.current);
      }
    },
    [],
  );

  const gameName = gameId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

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
          <h1>
            {gameName} Level Editor - <code>{levelId}</code>
          </h1>
        </header>
        <div className={styles.page}>
          <header className={styles.header}>
            <div className={styles.meta}>
              Game <code>{gameId}</code>
            </div>
            <Link href={`/games/${gameId}/levels`} className={styles.saveBtn}>
              Back to Levels
            </Link>
          </header>

          {error && <div className={styles.error}>Error: {error}</div>}
          {savedAt && <div className={styles.success}>Saved at {savedAt}</div>}

          <section className={styles.card}>
            <h2>Background Asset</h2>
            <AssetComponent
              gameId={gameId}
              assetId={`${levelId}.background`}
              displayName="Level Background"
              kind={backgroundDefinition.kind}
              acceptedFileTypes={['image/png', 'image/webp', 'image/jpeg']}
              definition={backgroundDefinition}
              spec={LEVEL_BACKGROUND_SPEC}
              fxOptions={[]}
              uploadingSlotId={uploadingBackgroundSlotId}
              onDefinitionChange={setBackgroundDefinition}
              onAssetUpdated={(next) => {
                setBackgroundDefinition(next);
                void persistBackgroundDefinition(next).catch((err) => {
                  setError((err as Error).message);
                });
              }}
              onUploadSlot={uploadBackgroundSlot}
            />
            <div className={styles.helper}>
              Saved to core assets as <code>{`${levelId}.background`}</code>.
              Uploading here stores the file in S3 and definition in DynamoDB.
            </div>
          </section>

          <section className={styles.card}>
            <h2>Formation</h2>
            <FormationComponent
              enemies={enemies}
              enemyIcons={enemyIcons}
              enemyCellSizes={enemyCellSizes}
              formation={config.formationGrid}
              onChange={(nextFormation) => {
                const nextConfig: LevelConfig = {
                  ...config,
                  formationGrid: nextFormation,
                  waves: toWavesFromFormation(nextFormation),
                };
                setConfig(nextConfig);
                void persistLevelConfig(nextConfig)
                  .then((savedConfig) => {
                    setConfig(savedConfig);
                    setSavedAt(new Date().toLocaleTimeString());
                    setError(null);
                  })
                  .catch((err) => {
                    setError((err as Error).message);
                  });
              }}
            />
          </section>

          <section className={styles.card}>
            <LevelPreviewComponent
              title="Level Config"
              backgroundUrl={previewBackgroundUrl}
              ships={previewShips}
              playerShip={playerShip}
              settings={{
                fleetSpeed: config.fleetSpeed,
                rampFactor: config.rampFactor,
                descendStep: config.descendStep,
                maxConcurrentDivers: config.maxConcurrentDivers,
                maxConcurrentShots: config.maxConcurrentShots,
                attackTickMs: config.attackTickMs,
                diveChancePerTick: config.diveChancePerTick,
                divePattern: config.divePattern,
                turnRate: config.turnRate,
                fireTickMs: config.fireTickMs,
                fireChancePerTick: config.fireChancePerTick,
              }}
            >
              <div className={styles.previewFieldSection}>
                <h4 className={styles.previewFieldTitle}>Difficulty / Fleet Behavior</h4>
                {knobChanged ? (
                  <div className={styles.warning}>
                    Warning: Changing these values affects difficulty and may impact
                    leaderboard comparability. Consider resetting or segmenting
                    leaderboards when publishing.
                  </div>
                ) : null}
                <div className={styles.grid2}>
                  <label className={styles.label}>
                    Fleet speed
                    <input
                      className={styles.input}
                      type="number"
                      min={0}
                      step={0.1}
                      value={config.fleetSpeed ?? 0}
                      onChange={(e) => updateKnob('fleetSpeed', Number(e.target.value))}
                    />
                    {knobErrors.fleetSpeed ? (
                      <div className={styles.error}>{knobErrors.fleetSpeed}</div>
                    ) : null}
                  </label>
                  <label className={styles.label}>
                    Ramp factor
                    <input
                      className={styles.input}
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={config.rampFactor ?? 0}
                      onChange={(e) => updateKnob('rampFactor', Number(e.target.value))}
                    />
                    {knobErrors.rampFactor ? (
                      <div className={styles.error}>{knobErrors.rampFactor}</div>
                    ) : null}
                  </label>
                  <label className={styles.label}>
                    Descend step
                    <input
                      className={styles.input}
                      type="number"
                      min={0}
                      step={1}
                      value={config.descendStep ?? 0}
                      onChange={(e) => updateKnob('descendStep', Number(e.target.value))}
                    />
                    {knobErrors.descendStep ? (
                      <div className={styles.error}>{knobErrors.descendStep}</div>
                    ) : null}
                  </label>
                  <label className={styles.label}>
                    Max concurrent divers
                    <input
                      className={styles.input}
                      type="number"
                      min={0}
                      step={1}
                      value={config.maxConcurrentDivers ?? 0}
                      onChange={(e) =>
                        updateKnob('maxConcurrentDivers', Number(e.target.value))
                      }
                    />
                    {knobErrors.maxConcurrentDivers ? (
                      <div className={styles.error}>
                        {knobErrors.maxConcurrentDivers}
                      </div>
                    ) : null}
                  </label>
                  <label className={styles.label}>
                    Max concurrent shots
                    <input
                      className={styles.input}
                      type="number"
                      min={0}
                      step={1}
                      value={config.maxConcurrentShots ?? 0}
                      onChange={(e) =>
                        updateKnob('maxConcurrentShots', Number(e.target.value))
                      }
                    />
                    {knobErrors.maxConcurrentShots ? (
                      <div className={styles.error}>
                        {knobErrors.maxConcurrentShots}
                      </div>
                    ) : null}
                  </label>
                </div>
              </div>

              <div className={styles.previewFieldSection}>
                <h4 className={styles.previewFieldTitle}>Dive / Attack</h4>
                {diveKnobChanged ? (
                  <div className={styles.warning}>
                    Warning: Changing dive/attack tuning affects difficulty and
                    leaderboard comparability.
                  </div>
                ) : null}
                <div className={styles.grid2}>
                  <label className={styles.label}>
                    attackTickMs
                    <input
                      className={styles.input}
                      type="number"
                      min={1}
                      step={1}
                      value={config.attackTickMs ?? 1}
                      onChange={(e) => updateKnob('attackTickMs', Number(e.target.value))}
                    />
                    {knobErrors.attackTickMs ? (
                      <div className={styles.error}>{knobErrors.attackTickMs}</div>
                    ) : null}
                  </label>
                  <label className={styles.label}>
                    diveChancePerTick
                    <input
                      className={styles.input}
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={config.diveChancePerTick ?? 0}
                      onChange={(e) =>
                        updateKnob('diveChancePerTick', Number(e.target.value))
                      }
                    />
                    {knobErrors.diveChancePerTick ? (
                      <div className={styles.error}>
                        {knobErrors.diveChancePerTick}
                      </div>
                    ) : null}
                  </label>
                  <label className={styles.label}>
                    Pattern
                    <select
                      className={styles.select}
                      value={config.divePattern ?? 'straight'}
                      onChange={(e) =>
                        updateKnob('divePattern', e.target.value as any)
                      }
                    >
                      <option value="straight">Straight</option>
                      <option value="sine">Sine</option>
                      <option value="track">Track</option>
                    </select>
                    {knobErrors.divePattern ? (
                      <div className={styles.error}>{knobErrors.divePattern}</div>
                    ) : null}
                  </label>
                  {trackingEnabled ? (
                    <label className={styles.label}>
                      turnRate
                      <input
                        className={styles.input}
                        type="number"
                        min={0}
                        max={10}
                        step={0.1}
                        value={config.turnRate ?? 0}
                        onChange={(e) => updateKnob('turnRate', Number(e.target.value))}
                      />
                      <div className={styles.helper}>
                        Capped to prevent perfect tracking.
                      </div>
                      {knobErrors.turnRate ? (
                        <div className={styles.error}>{knobErrors.turnRate}</div>
                      ) : null}
                    </label>
                  ) : null}
                </div>
              </div>

              <div className={styles.previewFieldSection}>
                <h4 className={styles.previewFieldTitle}>Shooting</h4>
                {shootKnobChanged ? (
                  <div className={styles.warning}>
                    Warning: Changing shooting tuning affects difficulty and
                    leaderboard comparability.
                  </div>
                ) : null}
                <div className={styles.grid2}>
                  <label className={styles.label}>
                    fireTickMs
                    <input
                      className={styles.input}
                      type="number"
                      min={1}
                      step={1}
                      value={config.fireTickMs ?? 1}
                      onChange={(e) => updateKnob('fireTickMs', Number(e.target.value))}
                    />
                    {knobErrors.fireTickMs ? (
                      <div className={styles.error}>{knobErrors.fireTickMs}</div>
                    ) : null}
                  </label>
                  <label className={styles.label}>
                    fireChancePerTick
                    <input
                      className={styles.input}
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={config.fireChancePerTick ?? 0}
                      onChange={(e) =>
                        updateKnob('fireChancePerTick', Number(e.target.value))
                      }
                    />
                    {knobErrors.fireChancePerTick ? (
                      <div className={styles.error}>
                        {knobErrors.fireChancePerTick}
                      </div>
                    ) : null}
                  </label>
                  <label className={styles.label}>
                    Max concurrent shots
                    <input
                      className={styles.input}
                      type="number"
                      min={0}
                      step={1}
                      value={config.maxConcurrentShots ?? 0}
                      onChange={(e) =>
                        updateKnob('maxConcurrentShots', Number(e.target.value))
                      }
                    />
                    {knobErrors.maxConcurrentShots ? (
                      <div className={styles.error}>
                        {knobErrors.maxConcurrentShots}
                      </div>
                    ) : null}
                  </label>
                </div>
                <div className={styles.helper}>
                  <strong>Shooting Rule:</strong> Column Shooter (locked). Only the
                  bottom-most living enemy in each column may fire. This is a core
                  fairness rule and not editable in v1.
                </div>
              </div>
            </LevelPreviewComponent>
          </section>

        </div>
      </main>
    </div>
  );
}
