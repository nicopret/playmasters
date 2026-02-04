import { NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { auth } from '../../../../../auth';
import { ASSETS_DRAFT_BUCKET, getAsset, getVersion } from '../../../../../../lib/imageAssets';
import { s3Client } from '../../../../../../lib/s3';

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });
export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('here');
  const session = await auth();
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin)
    return bad('unauthorized', 401);

  if (!ASSETS_DRAFT_BUCKET) return bad('draft_bucket_not_configured', 500);

  const { id } = await params;
console.log({ id })
  const asset = await getAsset(id);
  console.log({asset});
  if (!asset?.currentDraftVersionId) return bad('draft_not_found', 404);

  const draft = await getVersion(id, asset.currentDraftVersionId);
  console.log({draft});
  if (!draft) return bad('draft_not_found', 404);
  const storageKey = draft.storageKey;

  try {
    const obj = await s3Client.send(
      new GetObjectCommand({
        Bucket: ASSETS_DRAFT_BUCKET,
        Key: storageKey,
      })
    );
    const body = await obj.Body?.transformToByteArray();
    if (!body) return bad('missing_body', 500);
    return new NextResponse(Buffer.from(body), {
      status: 200,
      headers: {
        'Content-Type': obj.ContentType || 'image/png',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('draft_image_error', err);
    return bad('fetch_failed', 500);
  }
}
