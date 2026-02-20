import { NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { auth } from '../../../../../../auth';
import { ASSETS_DRAFT_BUCKET } from '../../../../../../../lib/imageAssets';
import { s3Client } from '../../../../../../../lib/s3';

export const runtime = 'nodejs';

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function GET(
  req: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  let session;
  try {
    session = await auth();
  } catch (err) {
    console.error('core_assets_file_auth', err);
    return bad('auth_failed', 500);
  }
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin) {
    return bad('unauthorized', 401);
  }
  if (!ASSETS_DRAFT_BUCKET) {
    return bad('draft_bucket_not_configured', 500);
  }

  const { gameId } = await params;
  const { searchParams } = new URL(req.url);
  const key = (searchParams.get('key') || '').trim();
  if (!key) return bad('key_required');
  if (
    !key.includes(`/core-assets/${gameId}/`) &&
    !key.includes('/core-assets/')
  ) {
    return bad('invalid_key', 400);
  }

  try {
    const obj = await s3Client.send(
      new GetObjectCommand({
        Bucket: ASSETS_DRAFT_BUCKET,
        Key: key,
      }),
    );
    const body = await obj.Body?.transformToByteArray();
    if (!body) return bad('missing_body', 500);
    return new NextResponse(Buffer.from(body), {
      status: 200,
      headers: {
        'Content-Type': obj.ContentType || 'application/octet-stream',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('core_assets_file_fetch_failed', err);
    return bad('fetch_failed', 500);
  }
}
