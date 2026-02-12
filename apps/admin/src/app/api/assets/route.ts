/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { imageSize } from 'image-size';
import { auth } from '../../../auth';
import type { ImageAsset } from '@playmasters/types';
import {
  ALLOWED_ASSET_TYPES,
  ASSETS_DRAFT_BUCKET,
  draftObjectKey,
  createAssetWithDraft,
  newAsset,
  newVersion,
  listAssets,
} from '../../../../lib/imageAssets';
import { logAudit } from '../../../../lib/audit';
import { s3Client } from '../../../../lib/s3';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
export const runtime = 'nodejs';
const MAX_MB = Number(process.env.ASSETS_MAX_UPLOAD_MB ?? '8');
const MAX_BYTES = MAX_MB * 1024 * 1024;

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function GET() {
  const session = await auth();
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin)
    return bad('unauthorized', 401);

  try {
    const assets = await listAssets();
    return NextResponse.json({ assets });
  } catch (err) {
    console.error('assets_list_error', err);
    return bad('list_failed', 500);
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin)
    return bad('unauthorized', 401);

  const form = await request.formData();
  const file = (form.get('file') || form.get('image')) as File | null;
  const type = (form.get('type') as string | null)?.trim();
  const title = (form.get('title') as string | null)?.trim();

  if (!file) return bad('file_required');
  if (!type) return bad('type_required');
  if (!title) return bad('title_required');
  if (!ALLOWED_TYPES.includes(file.type)) return bad('unsupported_type');
  if (!ALLOWED_ASSET_TYPES.includes(type as ImageAsset['type']))
    return bad('invalid_asset_type');

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) return bad('file_too_large');

  let dimensions;
  try {
    dimensions = imageSize(buffer);
  } catch {
    return bad('cannot_read_image');
  }
  if (!dimensions.width || !dimensions.height) return bad('missing_dimensions');

  const version = newVersion('', {
    state: 'Draft',
    storageKey: '',
    createdBy: session?.user?.id ?? 'anonymous',
  });
  const asset = newAsset({
    type: type as ImageAsset['type'],
    title,
    tags: [],
    width: dimensions.width,
    height: dimensions.height,
    currentDraftVersionId: version.versionId,
    currentPublishedVersionId: undefined,
  });

  // Finalize version with assetId and storage key
  const storageKey = draftObjectKey(asset.assetId, version.versionId);
  version.assetId = asset.assetId;
  version.storageKey = storageKey;

  // Type-specific validations (size constraints primarily for backgrounds)
  if (asset.type === 'background') {
    const maxDim = Number(process.env.ASSETS_MAX_BACKGROUND_DIM ?? '4096');
    if (asset.width > maxDim || asset.height > maxDim) {
      return bad('background_too_large');
    }
  }

  try {
    // Upload to draft bucket if configured; otherwise, in development, skip upload.
    if (ASSETS_DRAFT_BUCKET) {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: ASSETS_DRAFT_BUCKET,
          Key: storageKey,
          Body: buffer,
          ContentType: file.type,
          ContentLength: buffer.byteLength,
          // Prevent overwrite if the same key somehow exists
          IfNoneMatch: '*',
        }),
      );
    } else if (process.env.NODE_ENV !== 'development') {
      return bad('draft_bucket_not_configured', 500);
    }

    await createAssetWithDraft(asset, version);
  } catch (err) {
    const code = (err as any)?.name || (err as any)?.Code;
    if (code === 'PreconditionFailed') return bad('object_already_exists', 409);
    console.error('asset_upload_error', err);
    return bad('upload_failed', 500);
  }

  // Audit: asset creation + version upload
  const actorUserId = session?.user?.id;
  const actorEmail = session?.user?.email ?? undefined;
  await Promise.all([
    logAudit({
      entityType: 'ImageAsset',
      entityId: asset.assetId,
      action: 'CREATE_ASSET',
      actorUserId,
      actorEmail,
      details: { title, type },
    }),
    logAudit({
      entityType: 'ImageAssetVersion',
      entityId: version.versionId,
      action: 'UPLOAD_VERSION',
      actorUserId,
      actorEmail,
      details: { assetId: asset.assetId, storageKey, state: version.state },
    }),
  ]);

  return NextResponse.json({ asset });
}
