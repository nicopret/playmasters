import { NextResponse } from 'next/server';
import { getCurrentBundle } from '../../../../../lib/bundleStore';

export const runtime = 'nodejs';

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function GET(req: Request) {
  const url = new URL(req.url);
  const env = url.searchParams.get('env') ?? 'dev';
  const bundle = await getCurrentBundle(env);
  if (!bundle) return bad('no_published_bundle', 404);
  return NextResponse.json({
    versionId: bundle.versionId,
    configHash: bundle.configHash,
    bundle: bundle.bundle,
  });
}
