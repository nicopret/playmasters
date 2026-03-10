import { NextResponse } from 'next/server';
import { auth } from '../../../../../../auth';
import { publishLanderDrift } from '../../../../../../../lib/landerDrift';
import type { LanderDriftPublishResponse } from '@playmasters/types';

export const runtime = 'nodejs';

const bad = (message: string, status = 400, details?: unknown) =>
  NextResponse.json(
    details ? { error: message, details } : { error: message },
    { status },
  );

export async function POST(req: Request) {
  let session;
  try {
    session = await auth();
  } catch (err) {
    console.error('lander_drift_publish_auth_failed', err);
    return bad('auth_failed', 500);
  }

  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin) {
    return bad('unauthorized', 401);
  }

  const body = (await req.json().catch(() => ({}))) as { changeNotes?: string };
  const changeNotes =
    typeof body.changeNotes === 'string' ? body.changeNotes.trim() : '';

  try {
    const payload = (await publishLanderDrift({
      actor: {
        userId: session?.user?.id ?? 'anonymous',
        email: session?.user?.email ?? undefined,
      },
      changeNotes,
    })) satisfies LanderDriftPublishResponse;
    return NextResponse.json(payload);
  } catch (err) {
    const code = (err as Error).message;
    const details = (err as Error & { details?: unknown }).details;
    if (code === 'missing_ship_asset') return bad('missing_ship_asset', 400);
    if (code === 'missing_config') return bad('missing_config', 400);
    if (code === 'validation_failed')
      return bad('validation_failed', 400, details);
    if (code === 'ship_publish_binary_missing')
      return bad('ship_publish_binary_missing', 500);
    if (code === 'published_bucket_not_configured')
      return bad('published_bucket_not_configured', 500);
    console.error('lander_drift_publish_failed', err);
    return bad('publish_failed', 500);
  }
}
