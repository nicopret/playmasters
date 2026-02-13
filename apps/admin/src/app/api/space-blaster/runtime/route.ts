import { NextResponse } from 'next/server';
import {
  getCurrentBundle,
  getBundleVersion,
} from '../../../../../lib/bundleStore';

export const runtime = 'nodejs';

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

const normalizeRuntimeBundle = (bundle: unknown): unknown => {
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
    return bundle;
  }
  const record = bundle as Record<string, unknown>;
  if (!Array.isArray(record.levelConfigs) && Array.isArray(record.levels)) {
    return {
      ...record,
      levelConfigs: record.levels,
    };
  }
  return bundle;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const env = url.searchParams.get('env') ?? 'dev';
  const versionId = url.searchParams.get('versionId');
  const bundle = versionId
    ? await getBundleVersion(env, versionId)
    : await getCurrentBundle(env);
  if (!bundle) return bad('no_published_bundle', 404);
  return NextResponse.json({
    versionId: bundle.versionId,
    configHash: bundle.configHash,
    bundle: normalizeRuntimeBundle(bundle.bundle),
  });
}
