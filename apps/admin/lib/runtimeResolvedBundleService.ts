import type {
  ResolvedSpaceBlasterBundleV1,
  SpaceBlasterRuntimeResolverResponseV1,
} from '@playmasters/types';
import type { BundlePointer, PublishedBundle } from './bundleStore';
import { resolveBundleHashes } from './runtimeBundleHash';
import {
  buildResolvedBundleCacheKey,
  runtimeResolvedBundleCache,
  type RuntimeResolvedBundleCache,
} from './runtimeResolvedBundleCache';
import {
  resolveSpaceBlasterBundle,
  type BundleResolutionError,
} from './resolveSpaceBlasterBundle';

export interface RuntimeResolveError {
  readonly code:
    | 'MISSING_POINTER'
    | 'MISSING_PUBLISHED_BUNDLE'
    | 'MISSING_LAYOUT'
    | 'MISSING_ENEMY'
    | 'MISSING_HERO'
    | 'MISSING_AMMO'
    | 'INTERNAL_ERROR';
  readonly message: string;
  readonly status: 404 | 422 | 500;
  readonly details: Record<string, unknown>;
}

export type RuntimeResolveResult =
  | {
      ok: true;
      response: SpaceBlasterRuntimeResolverResponseV1;
      cacheHit: boolean;
    }
  | { ok: false; error: RuntimeResolveError };

interface ResolveRuntimeBundleResponseArgs {
  readonly gameId: string;
  readonly env: string;
  readonly getPointer: (env: string) => Promise<BundlePointer | null>;
  readonly getPublishedBundle: (
    env: string,
    versionId: string,
  ) => Promise<PublishedBundle | null>;
  readonly cache?: RuntimeResolvedBundleCache;
}

function toResolvedBundle(
  rawBundle: unknown,
  metadata: {
    configHash: string;
    versionHash: string;
    versionId: string;
    publishedAt?: string;
  },
  env: string,
  gameId: string,
): ResolvedSpaceBlasterBundleV1 {
  const bundle = (rawBundle ?? {}) as Record<string, unknown>;
  const levelConfigs = Array.isArray(bundle.levelConfigs)
    ? bundle.levelConfigs
    : Array.isArray(bundle.levels)
      ? bundle.levels
      : [];

  return {
    ...bundle,
    gameId,
    env,
    configHash: metadata.configHash,
    versionHash: metadata.versionHash,
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

function toBundleResolutionError(
  error: BundleResolutionError,
): RuntimeResolveError {
  return {
    code: error.code,
    status: 422,
    message: error.message,
    details: error.details as Record<string, unknown>,
  };
}

function missingPointerError(gameId: string, env: string): RuntimeResolveError {
  return {
    code: 'MISSING_POINTER',
    status: 404,
    message: `No active published bundle pointer found for ${gameId} (${env}).`,
    details: { gameId, env },
  };
}

function missingPublishedBundleError(
  gameId: string,
  env: string,
  versionId: string,
): RuntimeResolveError {
  return {
    code: 'MISSING_PUBLISHED_BUNDLE',
    status: 404,
    message: `Pointer references a missing published bundle for ${gameId} (${env}).`,
    details: { gameId, env, versionId },
  };
}

function internalError(gameId: string, env: string): RuntimeResolveError {
  return {
    code: 'INTERNAL_ERROR',
    status: 500,
    message: `Unable to resolve published bundle for ${gameId} (${env}).`,
    details: { gameId, env },
  };
}

export async function resolveRuntimeBundleResponse(
  args: ResolveRuntimeBundleResponseArgs,
): Promise<RuntimeResolveResult> {
  const cache = args.cache ?? runtimeResolvedBundleCache;
  try {
    const pointer = await args.getPointer(args.env);
    const pointerVersionId = pointer?.currentVersionId;
    if (!pointerVersionId) {
      return { ok: false, error: missingPointerError(args.gameId, args.env) };
    }

    const cacheKey = buildResolvedBundleCacheKey(
      args.gameId,
      args.env,
      pointerVersionId,
    );
    const cached = cache.get(cacheKey);
    if (cached) {
      return { ok: true, response: cached, cacheHit: true };
    }

    const published = await args.getPublishedBundle(args.env, pointerVersionId);
    if (!published) {
      return {
        ok: false,
        error: missingPublishedBundleError(
          args.gameId,
          args.env,
          pointerVersionId,
        ),
      };
    }

    const hashes = resolveBundleHashes({
      bundle: published.bundle,
      publishedConfigHash: published.configHash,
      publishedVersionHash: published.versionHash,
    });

    const unresolvedBundle = toResolvedBundle(
      published.bundle,
      {
        configHash: hashes.configHash,
        versionHash: hashes.versionHash,
        versionId: published.versionId,
        publishedAt: published.createdAt,
      },
      args.env,
      args.gameId,
    );

    const resolvedBundle = resolveSpaceBlasterBundle(unresolvedBundle);
    if (!resolvedBundle.ok) {
      return {
        ok: false,
        error: toBundleResolutionError(resolvedBundle.error),
      };
    }

    const response: SpaceBlasterRuntimeResolverResponseV1 = {
      versionId: published.versionId,
      configHash: hashes.configHash,
      bundle: resolvedBundle.resolved,
    };

    cache.set({
      key: cacheKey,
      gameId: args.gameId,
      env: args.env,
      versionId: pointerVersionId,
      value: response,
    });

    return { ok: true, response, cacheHit: false };
  } catch {
    return { ok: false, error: internalError(args.gameId, args.env) };
  }
}
