import { randomUUID } from 'crypto';
import { CopyObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import {
  TransactWriteCommand,
  QueryCommand,
  GetCommand,
  ScanCommand,
  BatchGetCommand,
} from '@aws-sdk/lib-dynamodb';
import { ddbDocClient } from './ddb';
import { s3Client } from './s3';
import type { ImageAsset, ImageAssetVersion } from '@playmasters/types';
import { countAssetUsage } from './assetUsage';
import { imageSize } from 'image-size';

export const IMAGE_TABLE = process.env.DDB_TABLE_IMAGE_EDITOR ?? 'PlaymastersImageEditor';
export const IMAGE_VERSIONS_TABLE =
  process.env.DDB_TABLE_IMAGE_EDITOR_VERSIONS ?? IMAGE_TABLE;
export const PK_ATTR = process.env.DDB_PK_NAME || 'PK';
export const SK_ATTR = process.env.DDB_SK_NAME || 'SK';

// Optional per-entity key overrides
export const ASSET_PK_ATTR = process.env.DDB_PK_NAME_ASSETS || PK_ATTR;
export const ASSET_SK_ATTR = process.env.DDB_SK_NAME_ASSETS || SK_ATTR;
export const VERSION_PK_ATTR = process.env.DDB_PK_NAME_ASSET_VERSIONS || PK_ATTR;
export const VERSION_SK_ATTR = process.env.DDB_SK_NAME_ASSET_VERSIONS || SK_ATTR;
export const ASSETS_DRAFT_BUCKET = process.env.ASSETS_DRAFT_BUCKET ?? '';
export const ASSETS_PUBLISHED_BUCKET = process.env.ASSETS_PUBLISHED_BUCKET ?? '';
export const ASSETS_PUBLIC_BASE_URL = process.env.ASSETS_PUBLIC_BASE_URL ?? '';
export const MAX_BACKGROUND_DIM = Number(process.env.ASSETS_MAX_BACKGROUND_DIM ?? '4096');
const ALLOWED_PUBLISH_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
export const ALLOWED_ASSET_TYPES: ImageAsset['type'][] = [
  'background',
  'sprite',
  'splash',
  'ui',
];
// Dynamo items include dynamic PK/SK attribute names defined by env.
// Use loose indexing to avoid over-constraining payload shape.
export type ImageAssetItem = ImageAsset & { [key: string]: any };
export type ImageAssetVersionItem = ImageAssetVersion & {
  [key: string]: any;
};
export type BackgroundCatalogItem = {
  assetId: string;
  title: string;
  tags: string[];
  width: number;
  height: number;
  publishedVersionId: string;
  publishedUrl: string;
  updatedAt: string;
};

export const buildAssetKeys = (assetId: string) => ({
  [ASSET_PK_ATTR]: `ASSET#${assetId}`,
  ...(ASSET_SK_ATTR ? { [ASSET_SK_ATTR]: 'META' } : {}),
});

export const buildVersionKeys = (assetId: string, versionId: string) => ({
  [VERSION_PK_ATTR]: `ASSET#${assetId}`,
  [VERSION_SK_ATTR]: versionId,
});

export const newAsset = (input: Omit<ImageAsset, 'assetId' | 'createdAt' | 'updatedAt'>): ImageAsset => {
  if (!ALLOWED_ASSET_TYPES.includes(input.type)) {
    throw new Error('invalid_asset_type');
  }
  const now = new Date().toISOString();
  return {
    assetId: randomUUID(),
    createdAt: now,
    updatedAt: now,
    ...input,
  };
};

export const newVersion = (
  assetId: string,
  input: Omit<ImageAssetVersion, 'versionId' | 'assetId' | 'createdAt'>
): ImageAssetVersion => ({
  versionId: randomUUID(),
  assetId,
  createdAt: new Date().toISOString(),
  ...input,
});

export async function createAssetWithDraft(
  asset: ImageAsset,
  version: ImageAssetVersion
): Promise<void> {
  const assetItem: ImageAssetItem = {
    ...asset,
    ...buildAssetKeys(asset.assetId),
  };
  const versionItem: ImageAssetVersionItem = {
    ...version,
    ...buildVersionKeys(asset.assetId, version.versionId),
  };

  await ddbDocClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: IMAGE_TABLE,
            Item: assetItem,
            ConditionExpression: 'attribute_not_exists(#pk)',
            ExpressionAttributeNames: { '#pk': ASSET_PK_ATTR },
          },
        },
        {
          Put: {
            TableName: IMAGE_VERSIONS_TABLE,
            Item: versionItem,
            ConditionExpression: 'attribute_not_exists(#pk) AND attribute_not_exists(#sk)',
            ExpressionAttributeNames: { '#pk': VERSION_PK_ATTR, '#sk': VERSION_SK_ATTR },
          },
        },
      ],
    })
  );
}

export async function listAssets(): Promise<ImageAsset[]> {
  const res = await ddbDocClient.send(
    new ScanCommand({
      TableName: IMAGE_TABLE,
      FilterExpression: 'begins_with(#pk, :prefix)',
      ExpressionAttributeNames: { '#pk': ASSET_PK_ATTR },
      ExpressionAttributeValues: { ':prefix': 'ASSET#' },
    })
  );
  const items = (res.Items ?? []) as ImageAssetItem[];
  return items
    .map((i) => {
      const { [ASSET_PK_ATTR]: _pk, ...rest } = i;
      return rest as ImageAsset;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listPublishedBackgroundCatalog(): Promise<BackgroundCatalogItem[]> {
  const res = await ddbDocClient.send(
    new ScanCommand({
      TableName: IMAGE_TABLE,
      FilterExpression: 'begins_with(#pk, :prefix) AND #type = :type AND attribute_exists(#pub)',
      ExpressionAttributeNames: { '#pk': ASSET_PK_ATTR, '#type': 'type', '#pub': 'currentPublishedVersionId' },
      ExpressionAttributeValues: { ':prefix': 'ASSET#', ':type': 'background' },
    })
  );
  const assets = (res.Items ?? []) as ImageAssetItem[];
  if (!assets.length) return [];

  const keys = assets
    .map((a) => {
      const publishedId = a.currentPublishedVersionId;
      if (!publishedId) return null;
      return {
        [VERSION_PK_ATTR]: `ASSET#${a.assetId}`,
        [VERSION_SK_ATTR]: publishedId,
      };
    })
    .filter(Boolean) as Record<string, string>[];

  let versions: ImageAssetVersionItem[] = [];
  if (keys.length) {
    const versionRes = await ddbDocClient.send(
      new BatchGetCommand({
        RequestItems: {
          [IMAGE_VERSIONS_TABLE]: {
            Keys: keys,
          },
        },
      })
    );
    versions = (versionRes.Responses?.[IMAGE_VERSIONS_TABLE] ?? []) as ImageAssetVersionItem[];
  }
  const versionMap = new Map<string, ImageAssetVersionItem>();
  versions.forEach((v) => versionMap.set(v.versionId, v));

  const mapped = assets.map((a) => {
    const publishedVersionId = a.currentPublishedVersionId;
    if (!publishedVersionId) return null;
    const v = versionMap.get(publishedVersionId);
    if (!v || v.state !== 'Published') return null;
    const ext = v.storageKey?.split('.').pop() || 'png';
    const publishedUrl =
      ASSETS_PUBLIC_BASE_URL && v.storageKey
        ? `${ASSETS_PUBLIC_BASE_URL.replace(/\/$/, '')}/${v.storageKey}`
        : getPublishedUrl(a.assetId, publishedVersionId, ext);

    const { [ASSET_PK_ATTR]: _pk, [ASSET_SK_ATTR]: _sk, ...rest } = a;
    const assetClean = rest as ImageAsset;
    return {
      assetId: assetClean.assetId,
      title: assetClean.title,
      tags: assetClean.tags,
      width: assetClean.width,
      height: assetClean.height,
      updatedAt: assetClean.updatedAt,
      publishedVersionId,
      publishedUrl,
    } as BackgroundCatalogItem;
  });

  return (mapped.filter(Boolean) as BackgroundCatalogItem[]).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

export async function getAsset(assetId: string): Promise<ImageAsset | null> {
  const res = await ddbDocClient.send(
    new GetCommand({
      TableName: IMAGE_TABLE,
      Key: buildAssetKeys(assetId),
    })
  );
  
  if (!res.Item) return null;
  const { [ASSET_PK_ATTR]: _pk, ...rest } = res.Item as ImageAssetItem;
  return rest as ImageAsset;
}

export async function listVersions(assetId: string): Promise<ImageAssetVersion[]> {
  const res = await ddbDocClient.send(
    new QueryCommand({
      TableName: IMAGE_VERSIONS_TABLE,
      KeyConditionExpression: `${VERSION_PK_ATTR} = :pk`,
      ExpressionAttributeValues: { ':pk': `ASSET#${assetId}` },
      ScanIndexForward: false,
    })
  );
  const items = (res.Items ?? []) as ImageAssetVersionItem[];
  return items
    .map((i) => {
      const { [VERSION_PK_ATTR]: _pk, [VERSION_SK_ATTR]: _sk, ...rest } = i;
      return rest as ImageAssetVersion;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getVersion(assetId: string, versionId: string): Promise<ImageAssetVersion | null> {
  if (!versionId) throw new Error('version_id_required');
  const res = await ddbDocClient.send(
    new QueryCommand({
      TableName: IMAGE_VERSIONS_TABLE,
      KeyConditionExpression: `${VERSION_PK_ATTR} = :pk AND ${VERSION_SK_ATTR} = :sk`,
      ExpressionAttributeValues: { ':pk': `ASSET#${assetId}`, ':sk': versionId },
    })
  );

  const item = (res.Items ?? [])?.[0] as ImageAssetVersionItem | undefined;
  if (!item) return null;
  const { [VERSION_PK_ATTR]: _pk, [VERSION_SK_ATTR]: _sk, ...rest } = item;
  return rest as ImageAssetVersion;
}

/**
 * S3 key helpers (immutable, never overwrite):
 * - Drafts live in the private bucket under drafts/images/{assetId}/{versionId}.png
 * - Published live in the public bucket under published/images/{assetId}/{versionId}.png
 */
export const draftObjectKey = (assetId: string, versionId: string) =>
  `drafts/images/${assetId}/${versionId}.png`;

export const publishedObjectKey = (assetId: string, versionId: string) =>
  `published/images/${assetId}/${versionId}.png`;

export const publicUrlForVersion = (assetId: string, versionId: string) => {
  if (!ASSETS_PUBLIC_BASE_URL) return '';
  const base = ASSETS_PUBLIC_BASE_URL.replace(/\/$/, '');
  return `${base}/published/images/${assetId}/${versionId}.png`;
};

export const getPublishedUrl = (assetId: string, versionId: string, ext = 'png') => {
  if (!ASSETS_PUBLIC_BASE_URL) return '';
  const base = ASSETS_PUBLIC_BASE_URL.replace(/\/$/, '');
  return `${base}/images/${assetId}/${versionId}.${ext.replace(/^\./, '')}`;
};

async function streamToBuffer(stream: any): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    stream.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

async function validateDraftBinary(asset: ImageAsset, draft: ImageAssetVersion) {
  if (!ASSETS_DRAFT_BUCKET) return; // skip in dev/no bucket
  if (!draft.storageKey) throw new Error('draft_missing_storage_key');

  // Ensure object exists
  let head;
  try {
    head = await s3Client.send(
      new HeadObjectCommand({
        Bucket: ASSETS_DRAFT_BUCKET,
        Key: draft.storageKey,
      })
    );
  } catch (err) {
    throw new Error('draft_binary_missing');
  }

  const ct = head.ContentType?.toLowerCase();
  if (ct && !ALLOWED_PUBLISH_MIME.includes(ct)) {
    throw new Error('draft_invalid_content_type');
  }

  if (asset.type === 'background' || asset.type === 'splash' || asset.type === 'sprite') {
    // fetch once to read dimensions
    try {
      const obj = await s3Client.send(
        new GetObjectCommand({ Bucket: ASSETS_DRAFT_BUCKET, Key: draft.storageKey })
      );
      const body = obj.Body as any;
      const buf = await streamToBuffer(body);
      const dims = imageSize(buf);
      if (!dims.width || !dims.height) throw new Error('draft_invalid_dimensions');
      if (dims.width > MAX_BACKGROUND_DIM || dims.height > MAX_BACKGROUND_DIM) {
        throw new Error('background_too_large');
      }
    } catch (err) {
      if ((err as Error).message === 'background_too_large') throw err;
      throw new Error('draft_dimension_read_failed');
    }
  }
}

type CreateDraftFromPublishedInput = {
  assetId: string;
  createdBy: string;
  changeNotes?: string;
};

export async function createDraftFromPublished({
  assetId,
  createdBy,
  changeNotes,
}: CreateDraftFromPublishedInput): Promise<{ asset: ImageAsset; version: ImageAssetVersion }> {
  const asset = await getAsset(assetId);
  if (!asset) throw new Error('asset_not_found');
  if (!asset.currentPublishedVersionId) throw new Error('no_published_version');
  if (asset.currentDraftVersionId) throw new Error('draft_already_exists');

  const publishedVersion = await getVersion(assetId, asset.currentPublishedVersionId);
  if (!publishedVersion) throw new Error('published_version_not_found');
  if (publishedVersion.state !== 'Published') throw new Error('version_not_published');

  const version = newVersion(assetId, {
    state: 'Draft',
    storageKey: '', // set after key helper
    createdBy,
    changeNotes: changeNotes?.trim() || undefined,
    derivedFromVersionId: publishedVersion.versionId,
  });
  version.storageKey = draftObjectKey(assetId, version.versionId);

  // Copy binary from published → draft bucket when both buckets are configured.
  if (ASSETS_DRAFT_BUCKET && ASSETS_PUBLISHED_BUCKET) {
    await s3Client.send(
      new CopyObjectCommand({
        Bucket: ASSETS_DRAFT_BUCKET,
        Key: version.storageKey,
        CopySource: `${ASSETS_PUBLISHED_BUCKET}/${publishedVersion.storageKey}`,
        MetadataDirective: 'COPY',
      })
    );
  } else if (process.env.NODE_ENV !== 'development') {
    throw new Error('draft_or_published_bucket_missing');
  }

  const now = new Date().toISOString();
  const versionItem: ImageAssetVersionItem = {
    ...version,
    ...buildVersionKeys(assetId, version.versionId),
  };

  const updatedAsset: ImageAsset = {
    ...asset,
    currentDraftVersionId: version.versionId,
    updatedAt: now,
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
            Key: buildAssetKeys(assetId),
            UpdateExpression: 'SET #draft = :draft, #updatedAt = :updatedAt',
            ConditionExpression:
              'attribute_exists(#pk) AND (attribute_not_exists(#draftAttr) OR #draftAttr = :emptyDraft)',
            ExpressionAttributeNames: {
              '#pk': ASSET_PK_ATTR,
              '#draft': 'currentDraftVersionId',
              '#draftAttr': 'currentDraftVersionId',
              '#updatedAt': 'updatedAt',
            },
            ExpressionAttributeValues: {
              ':draft': version.versionId,
              ':emptyDraft': null,
              ':updatedAt': now,
            },
          },
        },
      ],
    })
  );

  return { asset: updatedAsset, version };
}

export async function archiveVersion(assetId: string, versionId: string): Promise<ImageAssetVersion> {
  const asset = await getAsset(assetId);
  if (!asset) throw new Error('asset_not_found');

  const version = await getVersion(assetId, versionId);
  if (!version) throw new Error('version_not_found');
  if (version.state === 'Archived') return version;
  if (asset.currentDraftVersionId === versionId) throw new Error('cannot_archive_current_draft');
  if (asset.currentPublishedVersionId === versionId) throw new Error('cannot_archive_current_published');
  if (version.state === 'Published') {
    const usageCount = await countAssetUsage(assetId);
    if (usageCount > 0) throw new Error('version_in_use');
  }

  const now = new Date().toISOString();
  const versionKey = buildVersionKeys(assetId, versionId);

  await ddbDocClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: IMAGE_VERSIONS_TABLE,
            Key: versionKey,
            UpdateExpression: 'SET #state = :archived',
            ConditionExpression: '#state <> :archived',
            ExpressionAttributeNames: { '#state': 'state' },
            ExpressionAttributeValues: { ':archived': 'Archived' },
          },
        },
        {
          Update: {
            TableName: IMAGE_TABLE,
            Key: buildAssetKeys(assetId),
            UpdateExpression: 'SET #updatedAt = :updatedAt',
            ConditionExpression: 'attribute_exists(#pk)',
            ExpressionAttributeNames: { '#updatedAt': 'updatedAt', '#pk': ASSET_PK_ATTR },
            ExpressionAttributeValues: { ':updatedAt': now },
          },
        },
      ],
    })
  );

  return { ...version, state: 'Archived' };
}

type PublishDraftInput = {
  assetId: string;
  versionId: string;
  changeNotes: string;
};

export async function publishDraft({
  assetId,
  versionId,
  changeNotes,
}: PublishDraftInput): Promise<{ asset: ImageAsset; version: ImageAssetVersion }> {
  const asset = await getAsset(assetId);

  if (!asset) throw new Error('asset_not_found');
  if (!asset.currentDraftVersionId) throw new Error('no_draft');
  if (asset.currentDraftVersionId !== versionId) throw new Error('version_not_current_draft');
  if (!ALLOWED_ASSET_TYPES.includes(asset.type)) throw new Error('invalid_asset_type');

  const draft = await getVersion(assetId, versionId);
  if (!draft) throw new Error('version_not_found');
  if (draft.state !== 'Draft') throw new Error('version_not_draft');
  await validateDraftBinary(asset, draft);

  // Enforce publish-time constraints per asset type
  const draftExt = draft.storageKey?.split('.').pop()?.toLowerCase() || '';
  if (asset.type === 'background') {
    if (asset.width > MAX_BACKGROUND_DIM || asset.height > MAX_BACKGROUND_DIM) {
      throw new Error('background_too_large');
    }
    if (!['png', 'jpg', 'jpeg', 'webp'].includes(draftExt)) {
      throw new Error('background_invalid_format');
    }
  }
  if (asset.type === 'sprite') {
    if (draftExt !== 'png') {
      throw new Error('sprite_requires_png');
    }
  }

  if (!ASSETS_DRAFT_BUCKET || !ASSETS_PUBLISHED_BUCKET) {
    if (process.env.NODE_ENV !== 'development') throw new Error('storage_not_configured');
  }

  const previousPublishedId = asset.currentPublishedVersionId;
  const publishedKey = publishedObjectKey(assetId, versionId);

  // Copy draft → published (only when buckets available)
  if (ASSETS_DRAFT_BUCKET && ASSETS_PUBLISHED_BUCKET) {
    await s3Client.send(
      new CopyObjectCommand({
        Bucket: ASSETS_PUBLISHED_BUCKET,
        Key: publishedKey,
        CopySource: `${ASSETS_DRAFT_BUCKET}/${draft.storageKey}`,
        MetadataDirective: 'COPY',
      })
    );
  }

  const now = new Date().toISOString();
  const draftKey = buildVersionKeys(assetId, versionId);
  const transactItems: TransactWriteCommand['input']['TransactItems'] = [
    {
      Update: {
        TableName: IMAGE_VERSIONS_TABLE,
        Key: draftKey,
        UpdateExpression: 'SET #state = :published, #storageKey = :storageKey, #changeNotes = :changeNotes',
        ConditionExpression: '#state = :draft',
        ExpressionAttributeNames: {
          '#state': 'state',
          '#storageKey': 'storageKey',
          '#changeNotes': 'changeNotes',
        },
        ExpressionAttributeValues: {
          ':draft': 'Draft',
          ':published': 'Published',
          ':storageKey': publishedKey,
          ':changeNotes': changeNotes,
        },
      },
    },
    {
      Update: {
        TableName: IMAGE_TABLE,
        Key: buildAssetKeys(assetId),
        UpdateExpression:
          'SET #pub = :pub, #draft = :nullDraft, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#pub': 'currentPublishedVersionId',
          '#draft': 'currentDraftVersionId',
          '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':pub': versionId,
          ':nullDraft': null,
          ':updatedAt': now,
        },
      },
    },
  ];

  // Optionally archive previous published
  if (previousPublishedId) {
    const previous = await getVersion(assetId, previousPublishedId);
    if (previous) {
      transactItems.push({
        Update: {
          TableName: IMAGE_VERSIONS_TABLE,
          Key: buildVersionKeys(assetId, previous.versionId),
          UpdateExpression: 'SET #state = :archived',
          ConditionExpression: '#state = :published',
          ExpressionAttributeNames: { '#state': 'state' },
          ExpressionAttributeValues: { ':archived': 'Archived', ':published': 'Published' },
        },
      });
    }
  }

  await ddbDocClient.send(new TransactWriteCommand({ TransactItems: transactItems }));

  return {
    asset: {
      ...asset,
      currentDraftVersionId: undefined,
      currentPublishedVersionId: versionId,
      updatedAt: now,
    },
    version: { ...draft, state: 'Published', storageKey: publishedKey, changeNotes },
  };
}

type RollbackInput = {
  assetId: string;
  versionId: string;
};

export async function rollbackPublished({
  assetId,
  versionId,
}: RollbackInput): Promise<ImageAsset> {
  const asset = await getAsset(assetId);
  if (!asset) throw new Error('asset_not_found');
  if (asset.currentPublishedVersionId === versionId) return asset;

  const target = await getVersion(assetId, versionId);
  if (!target) throw new Error('version_not_found');
  if (target.state !== 'Published') throw new Error('version_not_published');

  const now = new Date().toISOString();
  await ddbDocClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: IMAGE_TABLE,
            Key: buildAssetKeys(assetId),
            UpdateExpression: 'SET #pub = :pub, #updatedAt = :updatedAt',
            ConditionExpression: 'attribute_exists(#pk)',
            ExpressionAttributeNames: {
              '#pk': ASSET_PK_ATTR,
              '#pub': 'currentPublishedVersionId',
              '#updatedAt': 'updatedAt',
            },
            ExpressionAttributeValues: {
              ':pub': versionId,
              ':updatedAt': now,
            },
          },
        },
      ],
    })
  );

  return {
    ...asset,
    currentPublishedVersionId: versionId,
    updatedAt: now,
  };
}
