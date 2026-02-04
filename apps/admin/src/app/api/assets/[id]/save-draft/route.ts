import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { auth } from '../../../../../auth';
import {
  ALLOWED_ASSET_TYPES,
  draftObjectKey,
  getAsset,
  newVersion,
  buildVersionKeys,
  IMAGE_VERSIONS_TABLE,
  IMAGE_TABLE,
  VERSION_PK_ATTR,
  VERSION_SK_ATTR,
  ASSET_PK_ATTR,
  ASSETS_DRAFT_BUCKET,
} from '../../../../../../lib/imageAssets';
import { ddbDocClient } from '../../../../../../lib/ddb';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { s3Client } from '../../../../../../lib/s3';
import { logAudit } from '../../../../../../lib/audit';

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
  const json = (await req.json().catch(() => null)) as { pngBase64?: string; changeNotes?: string };
  if (!json?.pngBase64) return bad('png_required');

  const asset = await getAsset(id);
  if (!asset) return bad('not_found', 404);
  if (!ALLOWED_ASSET_TYPES.includes(asset.type)) return bad('invalid_asset_type', 400);

  // decode base64
  let buffer: Buffer;
  try {
    buffer = Buffer.from(json.pngBase64, 'base64');
  } catch {
    return bad('invalid_base64');
  }

  const version = newVersion(id, {
    state: 'Draft',
    storageKey: '',
    createdBy: session?.user?.id ?? 'anonymous',
    changeNotes: json.changeNotes?.trim() || undefined,
  });
  version.storageKey = draftObjectKey(id, version.versionId);

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: ASSETS_DRAFT_BUCKET,
        Key: version.storageKey,
        Body: buffer,
        ContentType: 'image/png',
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
      details: { assetId: id, fromEditor: true },
    });
  } catch (err) {
    console.error('save_draft_error', err);
    return bad('save_failed', 500);
  }

  return NextResponse.json({ versionId: version.versionId });
}
