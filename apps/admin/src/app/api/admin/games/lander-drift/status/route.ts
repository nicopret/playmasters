import { NextResponse } from 'next/server';
import { auth } from '../../../../../../auth';
import {
  getCurrentPublishStatus,
  getLatestPublishMetadata,
} from '../../../../../../../lib/landerDrift';

export const runtime = 'nodejs';

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function GET() {
  let session;
  try {
    session = await auth();
  } catch (err) {
    console.error('lander_drift_status_auth_failed', err);
    return bad('auth_failed', 500);
  }

  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin) {
    return bad('unauthorized', 401);
  }

  try {
    const [status, latest] = await Promise.all([
      getCurrentPublishStatus(),
      getLatestPublishMetadata(),
    ]);
    return NextResponse.json({ status, latest });
  } catch (err) {
    console.error('lander_drift_status_failed', err);
    return bad('status_failed', 500);
  }
}
