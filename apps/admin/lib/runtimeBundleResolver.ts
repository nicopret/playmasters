import type { PublishedBundle } from './bundleStore';

export type RuntimeResolverErrorCode =
  | 'MISSING_POINTER'
  | 'MISSING_PUBLISHED_BUNDLE'
  | 'INTERNAL_ERROR';

export interface RuntimeResolverError {
  readonly code: RuntimeResolverErrorCode;
  readonly message: string;
  readonly status: 404 | 500;
  readonly details: {
    readonly gameId: string;
    readonly env: string;
    readonly versionId?: string;
  };
}

export interface RuntimeResolverSuccess {
  readonly ok: true;
  readonly bundle: PublishedBundle;
}

export interface RuntimeResolverFailure {
  readonly ok: false;
  readonly error: RuntimeResolverError;
}

export type RuntimeResolverResult =
  | RuntimeResolverSuccess
  | RuntimeResolverFailure;

interface BundlePointer {
  readonly env: string;
  readonly currentVersionId: string;
}

interface ResolveRuntimeBundleArgs {
  readonly gameId: string;
  readonly env: string;
  readonly getPointer: (env: string) => Promise<BundlePointer | null>;
  readonly getPublishedBundle: (
    env: string,
    versionId: string,
  ) => Promise<PublishedBundle | null>;
}

function missingPointerError(
  gameId: string,
  env: string,
): RuntimeResolverFailure {
  return {
    ok: false,
    error: {
      code: 'MISSING_POINTER',
      message: `No active published bundle pointer found for ${gameId} (${env}).`,
      status: 404,
      details: { gameId, env },
    },
  };
}

function missingBundleError(
  gameId: string,
  env: string,
  versionId: string,
): RuntimeResolverFailure {
  return {
    ok: false,
    error: {
      code: 'MISSING_PUBLISHED_BUNDLE',
      message: `Pointer references a missing published bundle for ${gameId} (${env}).`,
      status: 404,
      details: { gameId, env, versionId },
    },
  };
}

function internalError(gameId: string, env: string): RuntimeResolverFailure {
  return {
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: `Unable to resolve published bundle for ${gameId} (${env}).`,
      status: 500,
      details: { gameId, env },
    },
  };
}

export async function resolveRuntimeBundle(
  args: ResolveRuntimeBundleArgs,
): Promise<RuntimeResolverResult> {
  const { gameId, env, getPointer, getPublishedBundle } = args;
  try {
    const pointer = await getPointer(env);
    if (!pointer?.currentVersionId) return missingPointerError(gameId, env);

    const published = await getPublishedBundle(env, pointer.currentVersionId);
    if (!published)
      return missingBundleError(gameId, env, pointer.currentVersionId);

    return {
      ok: true,
      bundle: published,
    };
  } catch {
    return internalError(gameId, env);
  }
}
