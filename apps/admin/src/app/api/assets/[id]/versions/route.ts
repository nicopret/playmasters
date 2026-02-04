import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { auth } from '../../../../../auth';
import {
  ALLOWED_ASSET_TYPES,
  ASSETS_DRAFT_BUCKET,
  draftObjectKey,
  newVersion,
  buildVersionKeys,
  IMAGE_VERSIONS_TABLE,
  IMAGE_TABLE,
  VERSION_PK_ATTR,
  VERSION_SK_ATTR,
  ASSET_PK_ATTR,
  getAsset,
} from '../../../../../../lib/imageAssets';
import { s3Client } from '../../../../../../lib/s3';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { logAudit } from '../../../../../../lib/audit';
import { ddbDocClient } from '../../../../../../lib/ddb';

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });
export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin)
    return bad('unauthorized', 401);
  if (!ASSETS_DRAFT_BUCKET) return bad('draft_bucket_not_configured', 500);

  const { id } = await params;
  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return bad('file_required');
  if (!['image/png', 'image/webp', 'image/jpeg', 'image/jpg'].includes(file.type))
    return bad('unsupported_type');

  const changeNotes = (form.get('changeNotes') as string | null)?.trim() || undefined;
  const derivedFromVersionId = (form.get('derivedFromVersionId') as string | null)?.trim() || undefined;

  const asset = await getAsset(id);
  if (!asset) return bad('not_found', 404);
  if (!ALLOWED_ASSET_TYPES.includes(asset.type)) return bad('invalid_asset_type', 400);

  if (asset.type === 'sprite' && file.type !== 'image/png') {
    return bad('sprite_requires_png');
  }
  if (asset.type === 'background' && !['image/png', 'image/webp', 'image/jpeg', 'image/jpg'].includes(file.type)) {
    return bad('background_invalid_format');
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const version = newVersion(id, {
    state: 'Draft',
    storageKey: '',
    createdBy: session?.user?.id ?? 'anonymous',
    changeNotes,
    derivedFromVersionId,
  });
  version.storageKey = draftObjectKey(id, version.versionId);

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: ASSETS_DRAFT_BUCKET,
        Key: version.storageKey,
        Body: buffer,
        ContentType: file.type,
        ContentLength: buffer.byteLength,
      })
    );

    const now = new Date().toISOString();
    const versionItem = {
      ...version,
      ...buildVersionKeys(id, version.versionId),
    };

    await ddbDocClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: IMAGE_VERSIONS_TABLE,
              Item: versionItem,
              ConditionExpression: 'attribute_not_exists(#pk) AND attribute_not_exists(#sk)',
              ExpressionAttributeNames: { '#pk': VERSION_PK_ATTR, '#sk': VERSION_SK_ATTR },
            },
          },
          {
            Update: {
              TableName: IMAGE_TABLE,
              Key: { [ASSET_PK_ATTR]: `ASSET#${id}` },
              UpdateExpression: 'SET currentDraftVersionId = :draft, updatedAt = :updatedAt',
              ExpressionAttributeValues: {
                ':draft': version.versionId,
                ':updatedAt': now,
              },
            },
          },
        ],
      })
    );

    await logAudit({
      entityType: 'ImageAssetVersion',
      entityId: version.versionId,
      action: 'UPLOAD_VERSION',
      actorUserId: session?.user?.id,
      actorEmail: session?.user?.email ?? undefined,
      details: { assetId: id, derivedFromVersionId },
    });
  } catch (err) {
    console.error('version_create_error', err);
    return bad('version_create_failed', 500);
  }

  return NextResponse.json({ asset: { ...asset, currentDraftVersionId: version.versionId }, version });
}
