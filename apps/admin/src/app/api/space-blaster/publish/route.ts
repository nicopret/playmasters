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

export const runtime = 'nodejs';

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

function loadJson(relPath: string) {
  const abs = path.join(process.cwd(), relPath);
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function buildBundle() {
  const base = path.join(
    process.cwd(),
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
  const levelConfigs = [
    loadJson(path.join(base, 'level-1.v1.json')),
    loadJson(path.join(base, 'level-2.v1.json')),
    loadJson(path.join(base, 'level-3.v1.json')),
  ];
  return {
    gameConfig,
    enemyCatalog,
    heroCatalog,
    ammoCatalog,
    formationLayouts,
    scoreConfig,
    levelConfigs,
  };
}

export async function POST(req: Request) {
  const session = await auth();
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin)
    return bad('unauthorized', 401);

  const url = new URL(req.url);
  const env = url.searchParams.get('env') ?? 'dev';

  const bundle = buildBundle();
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

  runtimeResolvedBundleCache.invalidateGame('space-blaster', env);

  return NextResponse.json({
    versionId: published.versionId,
    configHash: published.configHash,
    versionHash,
  });
}
