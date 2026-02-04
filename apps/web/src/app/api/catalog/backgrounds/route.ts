import { NextResponse } from 'next/server';
import { ScanCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient } from '../../../../lib/ddb';

export const runtime = 'nodejs';

const IMAGE_TABLE = process.env.DDB_TABLE_IMAGE_EDITOR ?? 'PlaymastersImageEditor';
const IMAGE_VERSIONS_TABLE = process.env.DDB_TABLE_IMAGE_EDITOR_VERSIONS ?? IMAGE_TABLE;
const PK_ATTR = process.env.DDB_PK_NAME || 'PK';
const SK_ATTR = process.env.DDB_SK_NAME || 'SK';
const ASSET_PK_ATTR = process.env.DDB_PK_NAME_ASSETS || PK_ATTR;
const ASSET_SK_ATTR = process.env.DDB_SK_NAME_ASSETS || SK_ATTR;
const VERSION_PK_ATTR = process.env.DDB_PK_NAME_ASSET_VERSIONS || PK_ATTR;
const VERSION_SK_ATTR = process.env.DDB_SK_NAME_ASSET_VERSIONS || SK_ATTR;
const ASSETS_PUBLIC_BASE_URL = process.env.ASSETS_PUBLIC_BASE_URL ?? '';

type BackgroundItem = {
  assetId: string;
  title: string;
  tags: string[];
  width: number;
  height: number;
  publishedVersionId: string;
  publishedUrl: string;
  updatedAt: string;
};

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function GET() {
  try {
    const res = await ddbDocClient.send(
      new ScanCommand({
        TableName: IMAGE_TABLE,
        FilterExpression: 'begins_with(#pk, :prefix) AND #type = :type AND attribute_exists(#pub)',
        ExpressionAttributeNames: {
          '#pk': ASSET_PK_ATTR,
          '#type': 'type',
          '#pub': 'currentPublishedVersionId',
        },
        ExpressionAttributeValues: {
          ':prefix': 'ASSET#',
          ':type': 'background',
        },
      })
    );

    const assets = (res.Items ?? []) as any[];
    if (!assets.length) {
      return NextResponse.json(
        { backgrounds: [] },
        { headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=600' } }
      );
    }

    const keys = assets
      .map((a) => {
        const vid = a.currentPublishedVersionId;
        if (!vid) return null;
        return {
          [VERSION_PK_ATTR]: `ASSET#${a.assetId}`,
          [VERSION_SK_ATTR]: vid,
        };
      })
      .filter(Boolean) as Record<string, string>[];

    let versionMap = new Map<string, any>();
    if (keys.length) {
      const vRes = await ddbDocClient.send(
        new BatchGetCommand({
          RequestItems: { [IMAGE_VERSIONS_TABLE]: { Keys: keys } },
        })
      );
      const versions = (vRes.Responses?.[IMAGE_VERSIONS_TABLE] ?? []) as any[];
      versionMap = new Map(versions.map((v) => [v.versionId, v]));
    }

    const backgrounds: BackgroundItem[] = assets
      .map((a) => {
        const vid = a.currentPublishedVersionId;
        if (!vid) return null;
        const version = versionMap.get(vid);
        if (!version || version.state !== 'Published') return null;
        const storageKey: string | undefined = version.storageKey;
        const ext = storageKey?.split('.').pop() || 'png';
        const base = ASSETS_PUBLIC_BASE_URL.replace(/\/$/, '');
        const publishedUrl =
          storageKey && ASSETS_PUBLIC_BASE_URL
            ? `${base}/${storageKey}`
            : `${base}/images/${a.assetId}/${vid}.${ext}`;

        return {
          assetId: a.assetId,
          title: a.title,
          tags: a.tags ?? [],
          width: a.width,
          height: a.height,
          updatedAt: a.updatedAt,
          publishedVersionId: vid,
          publishedUrl,
        };
      })
      .filter(Boolean) as BackgroundItem[]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return NextResponse.json(
      { backgrounds },
      { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' } }
    );
  } catch (err) {
    console.error('public_catalog_backgrounds_error', err);
    return bad('catalog_failed', 500);
  }
}
