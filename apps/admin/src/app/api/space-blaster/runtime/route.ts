import { NextResponse } from 'next/server';
import {
  getBundlePointer,
  getBundleVersion,
} from '../../../../../lib/bundleStore';
import { resolveRuntimeBundleResponse } from '../../../../../lib/runtimeResolvedBundleService';

export const runtime = 'nodejs';

const gameId = 'space-blaster';
const defaultAllowedOrigins = new Set(['http://localhost:3000']);

function isLocalDevOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase();
    return (
      parsed.protocol === 'http:' &&
      (host === 'localhost' || host === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  const envAllowed = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const allowedOrigins = new Set([...defaultAllowedOrigins, ...envAllowed]);

  const allowOrigin =
    !!origin &&
    (allowedOrigins.has(origin) ||
      (process.env.NODE_ENV === 'development' && isLocalDevOrigin(origin)));

  if (!allowOrigin || !origin) {
    return {
      Vary: 'Origin',
    };
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(req),
  });
}

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
      { status: resolved.error.status, headers: buildCorsHeaders(req) },
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
  return NextResponse.json(resolved.response, {
    headers: buildCorsHeaders(req),
  });
}
