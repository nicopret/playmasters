import { NextResponse } from 'next/server';
import {
  getBundlePointer,
  getBundleVersion,
} from '../../../../../lib/bundleStore';
import { resolveRuntimeBundleResponse } from '../../../../../lib/runtimeResolvedBundleService';

export const runtime = 'nodejs';

const gameId = 'space-blaster';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const env = url.searchParams.get('env') ?? 'dev';
  const resolved = await resolveRuntimeBundleResponse({
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
      versionId:
        typeof resolved.error.details.versionId === 'string'
          ? resolved.error.details.versionId
          : undefined,
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
  console.info('[space-blaster-runtime] resolved bundle', {
    gameId,
    env,
    versionId: resolved.response.versionId,
    configHash: resolved.response.configHash,
    versionHash: resolved.response.bundle.versionHash,
    cacheHit: resolved.cacheHit,
  });
  return NextResponse.json(resolved.response);
}
