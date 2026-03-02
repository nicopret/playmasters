import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import fs from 'fs';
import path from 'path';
import {
  publishBundle,
  getCurrentBundle,
} from '../../../../../lib/bundleStore';
import { logAudit } from '../../../../../lib/audit';
import { computeConfigHashForBundle } from '../../../../../lib/runtimeBundleHash';
import { runtimeResolvedBundleCache } from '../../../../../lib/runtimeResolvedBundleCache';
import { listLevelConfigs } from '../../../../../lib/levelConfig';
import {
  getCoreAssetDefinition,
  getCoreAssetsDraft,
  type CoreAssetDefinition,
  type CoreAssetFileRef,
} from '../../../../../src/lib/coreAssets';

export const runtime = 'nodejs';
const gameId = 'space-blaster';
const RUNTIME_FLEET_SPEED_SCALE = 28;

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

const isMissingTableError = (err: unknown): boolean => {
  const name = (err as { name?: string }).name;
  const type = (err as { __type?: string }).__type;
  return (
    name === 'ResourceNotFoundException' ||
    type === 'com.amazonaws.dynamodb.v20120810#ResourceNotFoundException'
  );
};

function loadJson(relPath: string) {
  const abs = path.isAbsolute(relPath)
    ? relPath
    : path.resolve(process.cwd(), relPath);
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function findWorkspaceRoot(startDir: string): string {
  let current = startDir;
  for (let i = 0; i < 6; i += 1) {
    if (fs.existsSync(path.join(current, 'nx.json'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return startDir;
}

function toLevelSortKey(levelId: string): [number, number | string] {
  const match = levelId.match(/\d+/);
  if (!match) return [1, levelId];
  return [0, Number(match[0])];
}

function normalizeEnemyId(
  rawEnemyId: string,
  sampleEnemyIds: Set<string>,
): string {
  const normalized = rawEnemyId.trim();
  if (!normalized) return rawEnemyId;
  if (sampleEnemyIds.has(normalized)) return normalized;

  const token = normalized
    .replace(/^enemy[._]/i, '')
    .trim()
    .toLowerCase();
  const aliasesByToken: Record<string, string[]> = {
    // Admin/editor aliases used by core-asset definitions.
    fast: ['striker'],
  };
  const candidateTokens = [token, ...(aliasesByToken[token] ?? [])];

  const directCandidates = new Set<string>([
    normalized,
    normalized.replace(/^enemy\./i, 'enemy_'),
    normalized.replace(/^enemy_/i, 'enemy.'),
  ]);
  candidateTokens.forEach((candidateToken) => {
    if (!candidateToken) return;
    directCandidates.add(`enemy_${candidateToken}`);
    directCandidates.add(`enemy.${candidateToken}`);
    directCandidates.add(candidateToken);
  });

  for (const candidate of directCandidates) {
    if (sampleEnemyIds.has(candidate)) return candidate;
  }
  return rawEnemyId;
}

function toRuntimeWaves(
  waves: Array<{
    enemies?: Array<{ enemyId?: string; count?: number }>;
  }> = [],
  sampleEnemyIds: Set<string>,
) {
  return waves.flatMap((wave) =>
    (wave.enemies ?? [])
      .map((enemy) => {
        const rawEnemyId = `${enemy.enemyId ?? ''}`.trim();
        const count = Number.isFinite(enemy.count) ? Number(enemy.count) : 0;
        if (!rawEnemyId || count <= 0) return null;
        const normalizedEnemyId = normalizeEnemyId(rawEnemyId, sampleEnemyIds);
        if (!sampleEnemyIds.has(normalizedEnemyId)) return null;
        return {
          enemyId: normalizedEnemyId,
          count,
          spawnDelayMs: 0,
        };
      })
      .filter((entry): entry is { enemyId: string; count: number; spawnDelayMs: number } => !!entry),
  );
}

function toRuntimeWavesFromFormation(
  formationGrid: {
    placements?: Array<{ enemyId?: string }>;
  } | undefined,
  sampleEnemyIds: Set<string>,
) {
  const counts = new Map<string, number>();
  (formationGrid?.placements ?? []).forEach((placement) => {
    const rawEnemyId = `${placement.enemyId ?? ''}`.trim();
    if (!rawEnemyId) return;
    const enemyId = normalizeEnemyId(rawEnemyId, sampleEnemyIds);
    if (!sampleEnemyIds.has(enemyId)) return;
    counts.set(enemyId, (counts.get(enemyId) ?? 0) + 1);
  });
  return Array.from(counts.entries()).map(([enemyId, count]) => ({
    enemyId,
    count,
    spawnDelayMs: 0,
  }));
}

function toRuntimeFormationGrid(
  formationGrid:
    | {
        columns?: number;
        rows?: number;
        placements?: Array<{
          id?: string;
          enemyId?: string;
          col?: number;
          row?: number;
          width?: number;
          height?: number;
        }>;
      }
    | undefined,
  sampleEnemyIds: Set<string>,
) {
  if (!formationGrid) return undefined;
  const columns =
    typeof formationGrid.columns === 'number' && Number.isFinite(formationGrid.columns)
      ? Math.max(1, Math.floor(formationGrid.columns))
      : 10;
  const rows =
    typeof formationGrid.rows === 'number' && Number.isFinite(formationGrid.rows)
      ? Math.max(1, Math.floor(formationGrid.rows))
      : 5;
  const placements = (formationGrid.placements ?? [])
    .map((placement, index) => {
      const rawEnemyId = `${placement.enemyId ?? ''}`.trim();
      if (!rawEnemyId) return null;
      const enemyId = normalizeEnemyId(rawEnemyId, sampleEnemyIds);
      if (!sampleEnemyIds.has(enemyId)) return null;
      const col = Number(placement.col);
      const row = Number(placement.row);
      if (!Number.isFinite(col) || !Number.isFinite(row)) return null;
      const width =
        Number.isFinite(Number(placement.width)) && Number(placement.width) >= 2
          ? 2
          : 1;
      const height =
        Number.isFinite(Number(placement.height)) && Number(placement.height) >= 2
          ? 2
          : 1;
      return {
        id:
          typeof placement.id === 'string' && placement.id.trim()
            ? placement.id.trim()
            : `placement-${index}`,
        enemyId,
        col: Math.max(0, Math.floor(col)),
        row: Math.max(0, Math.floor(row)),
        width,
        height,
      };
    })
    .filter(
      (placement): placement is {
        id: string;
        enemyId: string;
        col: number;
        row: number;
        width: number;
        height: number;
      } => !!placement,
    );

  return { columns, rows, placements };
}

function toAssetUrl(
  file: CoreAssetFileRef | undefined,
  assetBaseUrl: string,
): string | undefined {
  if (!file) return undefined;
  if (typeof file.inlineDataUrl === 'string' && file.inlineDataUrl.trim()) {
    return file.inlineDataUrl;
  }
  if (typeof file.objectKey === 'string' && file.objectKey.trim()) {
    return `${assetBaseUrl}/api/games/${gameId}/assets/file?key=${encodeURIComponent(
      file.objectKey,
    )}`;
  }
  return undefined;
}

function readOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  return undefined;
}

function coreEnemyDefinitionIdForCatalogEnemy(enemyId: string): string {
  const token = enemyId.replace(/^enemy[._]/, '').trim().toLowerCase();
  if (!token) return 'enemy.grunt';
  if (token === 'striker') return 'enemy.fast';
  return `enemy.${token}`;
}

function toRuntimeShootingPercent(level: {
  fireTickMs?: number;
  fireChancePerTick?: number;
}): number {
  const tickMs =
    typeof level.fireTickMs === 'number' && Number.isFinite(level.fireTickMs)
      ? Math.max(1, level.fireTickMs)
      : 1000;
  const chance =
    typeof level.fireChancePerTick === 'number' &&
    Number.isFinite(level.fireChancePerTick)
      ? Math.max(0, Math.min(1, level.fireChancePerTick))
      : 0;
  const eventsPerSecond = 1000 / tickMs;
  const probabilityPerSecond = Math.max(0, Math.min(1, eventsPerSecond * chance));
  return Math.round(probabilityPerSecond * 100);
}

function mapAdminLevelToRuntimeLevel(
  level: {
    layoutId?: string;
    waves?: Array<{ enemies?: Array<{ enemyId?: string; count?: number }> }>;
    formationGrid?: { placements?: Array<{ enemyId?: string }> };
    fleetSpeed?: number;
    rampFactor?: number;
    descendStep?: number;
    maxConcurrentDivers?: number;
    attackTickMs?: number;
    diveChancePerTick?: number;
    divePattern?: string;
    turnRate?: number;
    fireTickMs?: number;
    fireChancePerTick?: number;
  },
  sampleLevelConfigs: Array<{ layoutId?: string }>,
  sampleEnemyIds: Set<string>,
  backgroundUrl?: string,
) {
  const formationWaves = toRuntimeWavesFromFormation(
    level.formationGrid,
    sampleEnemyIds,
  );
  const speed =
    typeof level.fleetSpeed === 'number' && Number.isFinite(level.fleetSpeed)
      ? Math.max(0, level.fleetSpeed) * RUNTIME_FLEET_SPEED_SCALE
      : undefined;
  const runtimeFormationGrid = toRuntimeFormationGrid(
    level.formationGrid,
    sampleEnemyIds,
  );
  const rampFactor =
    typeof level.rampFactor === 'number' && Number.isFinite(level.rampFactor)
      ? Math.max(0, Math.min(1, level.rampFactor))
      : undefined;
  const descendStep =
    typeof level.descendStep === 'number' && Number.isFinite(level.descendStep)
      ? Math.max(0, level.descendStep)
      : undefined;
  const attackTickMs =
    typeof level.attackTickMs === 'number' && Number.isFinite(level.attackTickMs)
      ? Math.max(1, level.attackTickMs)
      : undefined;
  const diveChancePerTick =
    typeof level.diveChancePerTick === 'number' &&
    Number.isFinite(level.diveChancePerTick)
      ? Math.max(0, Math.min(1, level.diveChancePerTick))
      : undefined;
  const turnRate =
    typeof level.turnRate === 'number' && Number.isFinite(level.turnRate)
      ? Math.max(0, level.turnRate)
      : undefined;

  return {
    layoutId: level.layoutId ?? sampleLevelConfigs[0]?.layoutId,
    waves:
      formationWaves.length > 0
        ? formationWaves
        : toRuntimeWaves(level.waves ?? [], sampleEnemyIds),
    ...(runtimeFormationGrid ? { formationGrid: runtimeFormationGrid } : {}),
    ...(backgroundUrl ? { backgroundUrl } : {}),
    // Runtime engine fields consumed by LevelSystem/FormationSystem/Game:
    ...(speed !== undefined ? { speed } : {}),
    ...(descendStep !== undefined ? { descendStep } : {}),
    ...(attackTickMs !== undefined ? { attackTickMs } : {}),
    ...(diveChancePerTick !== undefined ? { diveChancePerTick } : {}),
    ...(level.divePattern ? { divePattern: level.divePattern } : {}),
    ...(turnRate !== undefined ? { turnRate } : {}),
    shooting: toRuntimeShootingPercent(level),
    ...(rampFactor !== undefined
      ? {
          fleetSpeedRamp: {
            maxMultiplier: 1 + rampFactor,
            exponent: 1.25,
            smoothingPerSecond: 7,
            minAliveForRamp: 1,
          },
        }
      : {}),
    ...(attackTickMs !== undefined ||
    diveChancePerTick !== undefined ||
    (typeof level.maxConcurrentDivers === 'number' &&
      Number.isFinite(level.maxConcurrentDivers))
      ? {
          diveScheduler: {
            ...(attackTickMs !== undefined ? { attackTickMs } : {}),
            ...(diveChancePerTick !== undefined ? { diveChancePerTick } : {}),
            ...(typeof level.maxConcurrentDivers === 'number' &&
            Number.isFinite(level.maxConcurrentDivers)
              ? { maxConcurrentDivers: Math.max(0, Math.floor(level.maxConcurrentDivers)) }
              : {}),
          },
        }
      : {}),
    ...(level.divePattern || turnRate !== undefined
      ? {
          diveMotion: {
            ...(level.divePattern
              ? {
                  divePattern: level.divePattern as
                    | 'straight'
                    | 'sine'
                    | 'track',
                }
              : {}),
            ...(turnRate !== undefined ? { turnRate } : {}),
          },
        }
      : {}),
  };
}

async function buildBundle(assetBaseUrl: string) {
  const workspaceRoot = findWorkspaceRoot(process.cwd());
  const base = path.join(
    workspaceRoot,
    'packages',
    'types',
    'src',
    'space-blaster',
    'samples',
    'v1',
  );
  const gameConfig = loadJson(path.join(base, 'game-config.v1.json'));
  const enemyCatalog = loadJson(path.join(base, 'enemy-catalog.v1.json'));
  const heroCatalog = loadJson(path.join(base, 'hero-catalog.v1.json'));
  const ammoCatalog = loadJson(path.join(base, 'ammo-catalog.v1.json'));
  const formationLayouts = loadJson(
    path.join(base, 'formation-layouts.v1.json'),
  );
  const scoreConfig = loadJson(path.join(base, 'score-config.v1.json'));
  const sampleLevelConfigs = [
    loadJson(path.join(base, 'level-1.v1.json')),
    loadJson(path.join(base, 'level-2.v1.json')),
    loadJson(path.join(base, 'level-3.v1.json')),
  ];
  const sampleEnemyIds = new Set<string>(
    Array.isArray(enemyCatalog?.entries)
      ? enemyCatalog.entries
          .map((entry: { enemyId?: unknown }) =>
            typeof entry.enemyId === 'string' ? entry.enemyId : '',
          )
          .filter((enemyId: string): enemyId is string => enemyId.length > 0)
      : [],
  );

  try {
    const coreDraft = await getCoreAssetsDraft(gameId);
    const definitionById = new Map<string, CoreAssetDefinition>(
      coreDraft.definitions.map((definition) => [definition.id, definition]),
    );
    const playerDefinition = definitionById.get('hero.playerShip');
    const playerSpriteUrl = toAssetUrl(
      playerDefinition?.slots.find((slot) => slot.slotId === 'spriteKey')?.file,
      assetBaseUrl,
    );
    if (heroCatalog?.entries?.[0] && playerSpriteUrl) {
      heroCatalog.entries[0] = {
        ...heroCatalog.entries[0],
        spriteKey: playerSpriteUrl,
        spriteUrl: playerSpriteUrl,
      };
    }

    enemyCatalog.entries = (enemyCatalog.entries ?? []).map(
      (entry: Record<string, unknown>) => {
        const enemyId =
          typeof entry.enemyId === 'string' ? entry.enemyId : '';
        const definitionId = coreEnemyDefinitionIdForCatalogEnemy(enemyId);
        const definition = definitionById.get(definitionId);
        const spriteUrl = toAssetUrl(
          definition?.slots.find((slot) => slot.slotId === 'spriteKey')?.file,
          assetBaseUrl,
        );
        const canShoot = readOptionalBoolean(definition?.variables?.canShoot);
        const canDive = readOptionalBoolean(definition?.variables?.canDive);
        return {
          ...entry,
          ...(spriteUrl ? { spriteKey: spriteUrl, spriteUrl } : {}),
          ...(canShoot !== undefined ? { canShoot } : {}),
          ...(canDive !== undefined ? { canDive } : {}),
        };
      },
    );
  } catch (err) {
    console.warn('publish_core_assets_enrichment_failed', err);
  }

  const adminLevels = await listLevelConfigs(gameId);
  const runtimeLevels =
    adminLevels.length > 0
      ? await Promise.all(
          [...adminLevels]
          .sort((left, right) => {
            const leftKey = toLevelSortKey(left.levelId);
            const rightKey = toLevelSortKey(right.levelId);
            if (leftKey[0] !== rightKey[0]) return leftKey[0] - rightKey[0];
            if (typeof leftKey[1] === 'number' && typeof rightKey[1] === 'number') {
              if (leftKey[1] !== rightKey[1]) return leftKey[1] - rightKey[1];
              return left.levelId.localeCompare(right.levelId);
            }
            return String(leftKey[1]).localeCompare(String(rightKey[1]));
          })
          .map(async (level) => {
            const definitionId = `${level.levelId}.background`;
            const levelBackground = await getCoreAssetDefinition({
              gameId,
              definitionId,
            }).catch(() => null);
            const backgroundUrl = toAssetUrl(
              levelBackground?.slots.find((slot) => slot.slotId === 'image.main')
                ?.file,
              assetBaseUrl,
            );

            return mapAdminLevelToRuntimeLevel(
              level,
              sampleLevelConfigs,
              sampleEnemyIds,
              backgroundUrl,
            );
          }),
        )
      : sampleLevelConfigs;

  return {
    gameConfig,
    enemyCatalog,
    heroCatalog,
    ammoCatalog,
    formationLayouts,
    scoreConfig,
    levelConfigs: runtimeLevels,
  };
}

export async function POST(req: Request) {
  const session = await auth();
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin)
    return bad('unauthorized', 401);

  const url = new URL(req.url);
  const env = url.searchParams.get('env') ?? 'dev';

  const bundle = await buildBundle(url.origin);
  const configHash = computeConfigHashForBundle(bundle);
  const versionHash = configHash;
  const prev = await getCurrentBundle(env);

  const published = await publishBundle({
    env,
    configHash,
    versionHash,
    bundle,
    previousVersionId: prev?.versionId,
  });
  try {
    await logAudit({
      entityType: 'SpaceBlasterBundle',
      entityId: env,
      action: 'PUBLISH_BUNDLE',
      actorUserId: session?.user?.id,
      actorEmail: session?.user?.email ?? undefined,
      timestamp: published.createdAt,
      env,
      domain: 'SpaceBlaster',
      prevVersion: prev?.versionId ?? null,
      newVersion: published.versionId,
      status: 'success',
      details: { configHash: published.configHash, versionHash },
    });
  } catch (err) {
    if (!isMissingTableError(err)) {
      console.warn('publish_bundle_audit_failed', err);
    } else {
      console.warn('publish_bundle_audit_table_missing');
    }
  }

  runtimeResolvedBundleCache.invalidateGame('space-blaster', env);

  return NextResponse.json({
    versionId: published.versionId,
    configHash: published.configHash,
    versionHash,
  });
}
