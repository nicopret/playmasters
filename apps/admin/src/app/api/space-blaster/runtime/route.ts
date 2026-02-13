import { NextResponse } from 'next/server';
import type {
  ResolvedSpaceBlasterBundleV1,
  SpaceBlasterRuntimeResolverResponseV1,
} from '@playmasters/types';
import {
  getCurrentBundle,
  getBundleVersion,
} from '../../../../../lib/bundleStore';

export const runtime = 'nodejs';

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

function toResolvedBundle(
  rawBundle: unknown,
  metadata: { configHash: string; versionId: string; publishedAt?: string },
  env: string,
): ResolvedSpaceBlasterBundleV1 {
  const bundle = (rawBundle ?? {}) as Record<string, unknown>;
  const levelConfigs = Array.isArray(bundle.levelConfigs)
    ? bundle.levelConfigs
    : Array.isArray(bundle.levels)
      ? bundle.levels
      : [];

  return {
    ...bundle,
    gameId: 'space-blaster',
    env,
    configHash: metadata.configHash,
    versionId: metadata.versionId,
    publishedAt: metadata.publishedAt,
    levelConfigs: levelConfigs as ResolvedSpaceBlasterBundleV1['levelConfigs'],
    gameConfig: (bundle.gameConfig ??
      {}) as ResolvedSpaceBlasterBundleV1['gameConfig'],
    heroCatalog: (bundle.heroCatalog ??
      {}) as ResolvedSpaceBlasterBundleV1['heroCatalog'],
    enemyCatalog: (bundle.enemyCatalog ??
      {}) as ResolvedSpaceBlasterBundleV1['enemyCatalog'],
    ammoCatalog: (bundle.ammoCatalog ??
      {}) as ResolvedSpaceBlasterBundleV1['ammoCatalog'],
    formationLayouts: (bundle.formationLayouts ??
      {}) as ResolvedSpaceBlasterBundleV1['formationLayouts'],
    scoreConfig: (bundle.scoreConfig ??
      {}) as ResolvedSpaceBlasterBundleV1['scoreConfig'],
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const env = url.searchParams.get('env') ?? 'dev';
  const versionId = url.searchParams.get('versionId');
  const bundle = versionId
    ? await getBundleVersion(env, versionId)
    : await getCurrentBundle(env);
  if (!bundle) return bad('no_published_bundle', 404);
  const resolvedBundle = toResolvedBundle(
    bundle.bundle,
    {
      configHash: bundle.configHash,
      versionId: bundle.versionId,
      publishedAt: bundle.createdAt,
    },
    env,
  );

  const response: SpaceBlasterRuntimeResolverResponseV1 = {
    versionId: bundle.versionId,
    configHash: bundle.configHash,
    bundle: resolvedBundle,
  };
  return NextResponse.json(response);
}
