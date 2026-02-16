import { NextResponse } from 'next/server';
import type {
  ResolvedSpaceBlasterBundleV1,
  SpaceBlasterRuntimeResolverResponseV1,
} from '@playmasters/types';
import {
  getBundlePointer,
  getBundleVersion,
} from '../../../../../lib/bundleStore';
import { resolveRuntimeBundle } from '../../../../../lib/runtimeBundleResolver';

export const runtime = 'nodejs';

const gameId = 'space-blaster';

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
  const resolved = await resolveRuntimeBundle({
    gameId,
    env,
    getPointer: getBundlePointer,
    getPublishedBundle: getBundleVersion,
  });
  if (!resolved.ok) {
    console.warn('[space-blaster-runtime] resolve failed', {
      code: resolved.error.code,
      gameId,
      env,
      versionId: resolved.error.details.versionId,
    });
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: resolved.error.code,
          message: resolved.error.message,
          details: resolved.error.details,
        },
      },
      { status: resolved.error.status },
    );
  }
  const bundle = resolved.bundle;
  const resolvedBundle = toResolvedBundle(
    bundle.bundle,
    {
      configHash: bundle.configHash,
      versionId: bundle.versionId,
      publishedAt: bundle.createdAt,
    },
    env,
  );
  console.info('[space-blaster-runtime] resolved bundle', {
    gameId,
    env,
    versionId: bundle.versionId,
    configHash: bundle.configHash,
  });

  const response: SpaceBlasterRuntimeResolverResponseV1 = {
    versionId: bundle.versionId,
    configHash: bundle.configHash,
    bundle: resolvedBundle,
  };
  return NextResponse.json(response);
}
