import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { auth } from '../../../../../../auth';
import { ASSETS_DRAFT_BUCKET } from '../../../../../../../lib/imageAssets';
import { s3Client } from '../../../../../../../lib/s3';

export const runtime = 'nodejs';

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

const sanitize = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');

const extensionFor = (name: string): string => {
  const parts = name.split('.');
  if (parts.length < 2) return 'bin';
  const ext = parts[parts.length - 1].toLowerCase();
  return ext || 'bin';
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  let session;
  try {
    session = await auth();
  } catch (err) {
    console.error('core_assets_upload_auth', err);
    return bad('auth_failed', 500);
  }
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin) {
    return bad('unauthorized', 401);
  }

  const { gameId } = await params;
  const form = await req.formData();
  const definitionId = String(form.get('definitionId') || '').trim();
  const slotId = String(form.get('slotId') || '').trim();
  const media = String(form.get('media') || '').trim();
  const file = form.get('file') as File | null;

  if (!definitionId) return bad('definition_id_required');
  if (!slotId) return bad('slot_id_required');
  if (!file) return bad('file_required');
  if (!['image', 'audio'].includes(media)) return bad('media_invalid');

  const maxMb = Number(process.env.ASSETS_MAX_UPLOAD_MB ?? '8');
  const maxBytes = maxMb * 1024 * 1024;
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength > maxBytes) return bad('file_too_large');

  if (media === 'image' && !file.type.startsWith('image/')) {
    return bad('image_type_required');
  }
  if (media === 'audio' && !file.type.startsWith('audio/')) {
    return bad('audio_type_required');
  }

  const now = new Date().toISOString();
  if (!ASSETS_DRAFT_BUCKET) {
    if (process.env.NODE_ENV !== 'development') {
      return bad('draft_bucket_not_configured', 500);
    }
    return NextResponse.json({
      file: {
        inlineDataUrl: `data:${file.type};base64,${bytes.toString('base64')}`,
        fileName: file.name,
        contentType: file.type,
        uploadedAt: now,
      },
    });
  }

  const objectKey = `drafts/core-assets/${sanitize(gameId)}/${sanitize(definitionId)}/${sanitize(slotId)}/${randomUUID()}.${extensionFor(file.name)}`;
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: ASSETS_DRAFT_BUCKET,
        Key: objectKey,
        Body: bytes,
        ContentType: file.type || 'application/octet-stream',
        ContentLength: bytes.byteLength,
      }),
    );
  } catch (err) {
    console.error('core_assets_upload_failed', err);
    return bad('upload_failed', 500);
  }

  return NextResponse.json({
    file: {
      objectKey,
      fileName: file.name,
      contentType: file.type,
      uploadedAt: now,
    },
  });
}
