import { NextResponse } from 'next/server';
import { auth } from '../../../../../../../auth';
import {
  resolveLanderDriftConfigForSource,
  type LanderDriftConfigSource,
} from '../../../../../../../../lib/landerDrift';

export const runtime = 'nodejs';

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

const parseSource = (value: string | null): LanderDriftConfigSource => {
  if (value === 'draft') return 'draft';
  if (value === 'published') return 'published';
  return 'defaults';
};

export async function GET(req: Request) {
  let session;
  try {
    session = await auth();
  } catch (err) {
    console.error('lander_drift_test_config_auth_failed', err);
    return bad('auth_failed', 500);
  }
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin) {
    return bad('unauthorized', 401);
  }

  try {
    const source = parseSource(new URL(req.url).searchParams.get('source'));
    const resolved = await resolveLanderDriftConfigForSource(source);
    return NextResponse.json({
      source: resolved.source,
      availableSources: resolved.availableSources,
      config: resolved.config,
    });
  } catch (err) {
    console.error('lander_drift_test_config_failed', err);
    return bad('test_config_failed', 500);
  }
}
