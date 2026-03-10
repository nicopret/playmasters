import { NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { auth } from '../../../../../../../../auth';
import { s3Client } from '../../../../../../../../../lib/s3';

export const runtime = 'nodejs';

const DRAFT_BUCKET = process.env.ASSETS_DRAFT_BUCKET ?? '';
const KEY_PREFIX = 'games/lander-drift/assets/player-ship/draft/';

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function GET(req: Request) {
  let session;
  try {
    session = await auth();
  } catch (err) {
    console.error('lander_drift_ship_file_auth_failed', err);
    return bad('auth_failed', 500);
  }

  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin) {
    return bad('unauthorized', 401);
  }

  if (!DRAFT_BUCKET) {
    return bad('draft_bucket_not_configured', 500);
  }

  const key = new URL(req.url).searchParams.get('key')?.trim() ?? '';
  if (!key) return bad('key_required', 400);
  if (!key.startsWith(KEY_PREFIX)) return bad('invalid_key', 400);

  try {
    const object = await s3Client.send(
      new GetObjectCommand({
        Bucket: DRAFT_BUCKET,
        Key: key,
      }),
    );
    const body = await object.Body?.transformToByteArray();
    if (!body) return bad('missing_body', 500);
    return new NextResponse(Buffer.from(body), {
      status: 200,
      headers: {
        'Content-Type': object.ContentType ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('lander_drift_ship_file_fetch_failed', err);
    return bad('fetch_failed', 500);
  }
}
