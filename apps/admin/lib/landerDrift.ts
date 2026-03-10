import { randomUUID } from 'crypto';
import { CopyObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { imageSize } from 'image-size';
import type {
  LanderDriftConfigV1,
  LanderDriftPhysicsV1,
  LanderDriftPublishResponse,
} from '@playmasters/types';
import { ddbDocClient } from './ddb';
import { s3Client } from './s3';
import { ASSETS_PUBLIC_BASE_URL } from './imageAssets';

const GAME_ID = 'lander-drift' as const;
const LANDER_DRIFT_CONFIG_SCHEMA_VERSION = 'lander-drift.config.v1' as const;
const SHIP_ASSET_ID = 'player-ship';
const CONFIG_DOC_ID = `game#${GAME_ID}#config`;
const TABLE_NAME =
  process.env.DDB_TABLE_LANDER_DRIFT ??
  process.env.DDB_TABLE_GAME_CORE_ASSETS ??
  'PlaymastersGameAssets';
const PK_ATTR =
  process.env.DDB_PK_NAME_LANDER_DRIFT ??
  process.env.DDB_PK_NAME_GAME_CORE_ASSETS ??
  'PK';
const SK_ATTR =
  process.env.DDB_SK_NAME_LANDER_DRIFT ??
  process.env.DDB_SK_NAME_GAME_CORE_ASSETS ??
  'SK';
const DRAFT_BUCKET = process.env.ASSETS_DRAFT_BUCKET ?? '';
const PUBLISHED_BUCKET = process.env.ASSETS_PUBLISHED_BUCKET ?? '';

const ASSET_PK = `GAME#${GAME_ID}#ASSET#${SHIP_ASSET_ID}`;
const CONFIG_PK = `GAME#${GAME_ID}#CONFIG#main`;
const PUBLISH_PK = `GAME#${GAME_ID}#PUBLISH`;

type Actor = {
  userId: string;
  email?: string;
};

type ShipAssetMeta = {
  entityType: 'LanderShipAsset';
  gameId: typeof GAME_ID;
  assetId: string;
  type: 'playerShip';
  status: 'empty' | 'draft' | 'published' | 'both';
  currentDraftVersionId?: string;
  currentPublishedVersionId?: string;
  createdAt: string;
  updatedAt: string;
  lastPublishedAt?: string;
  draftName?: string;
};

type ShipAssetVersion = {
  entityType: 'LanderShipAssetVersion';
  gameId: typeof GAME_ID;
  assetId: string;
  versionId: string;
  state: 'Draft' | 'Published';
  s3Key?: string;
  inlineDataUrl?: string;
  fileName: string;
  contentType: string;
  width: number;
  height: number;
  createdAt: string;
  createdBy: string;
  changeNotes?: string;
  derivedFromVersionId?: string;
};

export type DraftShipSnapshot = {
  draftVersionId: string;
  draftName: string;
  fileName: string;
  contentType: string;
  s3Key?: string;
  inlineDataUrl?: string;
};

type ConfigDocMeta = {
  entityType: 'LanderConfigDoc';
  gameId: typeof GAME_ID;
  docId: string;
  schemaVersion: typeof LANDER_DRIFT_CONFIG_SCHEMA_VERSION;
  currentDraftVersionId?: string;
  currentPublishedVersionId?: string;
  createdAt: string;
  updatedAt: string;
  lastPublishedAt?: string;
};

type ConfigDocVersion = {
  entityType: 'LanderConfigDocVersion';
  gameId: typeof GAME_ID;
  docId: string;
  versionId: string;
  state: 'Draft' | 'Published';
  s3Key?: string;
  inlineJson?: string;
  config: LanderDriftConfigV1;
  createdAt: string;
  createdBy: string;
  changeNotes?: string;
  derivedFromVersionId?: string;
};

export type PublishStatus = {
  gameId: typeof GAME_ID;
  ship: {
    hasDraft: boolean;
    hasPublished: boolean;
    currentDraftVersionId?: string;
    currentPublishedVersionId?: string;
    lastPublishedAt?: string;
  };
  config: {
    hasDraft: boolean;
    hasPublished: boolean;
    currentDraftVersionId?: string;
    currentPublishedVersionId?: string;
  };
  readiness: {
    state:
      | 'ready'
      | 'missing_ship_asset'
      | 'missing_config'
      | 'validation_failed';
    message: string;
    validationIssues: Array<{ path: string; message: string }>;
  };
  draftConfig?: LanderDriftConfigV1;
};

export type LanderDriftConfigSource = 'draft' | 'published' | 'defaults';

export type ResolvedLanderDriftConfig = {
  source: LanderDriftConfigSource;
  config: LanderDriftConfigV1;
  availableSources: {
    draft: { enabled: boolean; reason?: string };
    published: { enabled: boolean; reason?: string };
    defaults: { enabled: true };
  };
};

const key = (pkValue: string, skValue: string) => ({
  [PK_ATTR]: pkValue,
  [SK_ATTR]: skValue,
});
const versionSk = (versionId: string) => `VERSION#${versionId}`;

const nowIso = () => new Date().toISOString();

const num = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const inferImageExtension = (fileName: string, contentType: string): string => {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.png')) return 'png';
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'jpg';
  if (lowerName.endsWith('.webp')) return 'webp';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  if (contentType.includes('webp')) return 'webp';
  return 'png';
};

const toPublicUrl = (s3Key: string): string => {
  if (!ASSETS_PUBLIC_BASE_URL) return '';
  return `${ASSETS_PUBLIC_BASE_URL.replace(/\/$/, '')}/${s3Key}`;
};

const shipDraftS3Key = (versionId: string, ext: string) =>
  `games/${GAME_ID}/assets/player-ship/draft/${versionId}.${ext}`;

const shipPublishedS3Key = (versionId: string, ext: string) =>
  `games/${GAME_ID}/assets/player-ship/published/${versionId}.${ext}`;

const configDraftS3Key = (versionId: string) =>
  `games/${GAME_ID}/config/draft/${versionId}.json`;

const configPublishedS3Key = (versionId: string) =>
  `games/${GAME_ID}/config/published/${versionId}.json`;

const getMeta = async <T>(pkValue: string): Promise<T | null> => {
  const res = await ddbDocClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: key(pkValue, 'META'),
    }),
  );
  if (!res.Item) return null;
  const { [PK_ATTR]: _pk, [SK_ATTR]: _sk, ...rest } = res.Item;
  void _pk;
  void _sk;
  return rest as T;
};

const getVersion = async <T>(
  pkValue: string,
  versionId: string,
): Promise<T | null> => {
  const res = await ddbDocClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: key(pkValue, versionSk(versionId)),
    }),
  );
  if (!res.Item) return null;
  const { [PK_ATTR]: _pk, [SK_ATTR]: _sk, ...rest } = res.Item;
  void _pk;
  void _sk;
  return rest as T;
};

export function validateLanderDriftConfig(config: unknown): Array<{
  path: string;
  message: string;
}> {
  const issues: Array<{ path: string; message: string }> = [];
  if (!config || typeof config !== 'object') {
    issues.push({ path: 'config', message: 'Config is required.' });
    return issues;
  }

  const candidate = config as Partial<LanderDriftConfigV1>;
  if (candidate.schemaVersion !== LANDER_DRIFT_CONFIG_SCHEMA_VERSION) {
    issues.push({
      path: 'schemaVersion',
      message: `Expected '${LANDER_DRIFT_CONFIG_SCHEMA_VERSION}'.`,
    });
  }
  if (candidate.gameId !== GAME_ID) {
    issues.push({ path: 'gameId', message: `Expected '${GAME_ID}'.` });
  }

  const physics = candidate.ship?.physics;
  if (!candidate.ship?.assetId?.trim()) {
    issues.push({ path: 'ship.assetId', message: 'ship.assetId is required.' });
  }
  if (!physics) {
    issues.push({ path: 'ship.physics', message: 'ship.physics is required.' });
  } else {
    if (!num(physics.mass))
      issues.push({ path: 'ship.physics.mass', message: 'Must be numeric.' });
    if (!num(physics.thrust))
      issues.push({ path: 'ship.physics.thrust', message: 'Must be numeric.' });
    if (!num(physics.rotationSpeed)) {
      issues.push({
        path: 'ship.physics.rotationSpeed',
        message: 'Must be numeric.',
      });
    }
    if (!num(physics.damping)) {
      issues.push({
        path: 'ship.physics.damping',
        message: 'Must be numeric.',
      });
    }
  }

  const landing = candidate.landing;
  if (!landing) {
    issues.push({
      path: 'landing',
      message: 'landing thresholds are required.',
    });
  } else {
    if (!num(landing.safeVerticalSpeed)) {
      issues.push({
        path: 'landing.safeVerticalSpeed',
        message: 'Must be numeric.',
      });
    }
    if (!num(landing.maxTiltDegrees)) {
      issues.push({
        path: 'landing.maxTiltDegrees',
        message: 'Must be numeric.',
      });
    }
    if (!num(landing.padSnapDistance)) {
      issues.push({
        path: 'landing.padSnapDistance',
        message: 'Must be numeric.',
      });
    }
  }

  const fuel = candidate.fuel;
  if (!fuel) {
    issues.push({ path: 'fuel', message: 'fuel values are required.' });
  } else {
    if (!num(fuel.maxFuel))
      issues.push({ path: 'fuel.maxFuel', message: 'Must be numeric.' });
    if (!num(fuel.burnRate))
      issues.push({ path: 'fuel.burnRate', message: 'Must be numeric.' });
    if (!num(fuel.idleDrainRate)) {
      issues.push({ path: 'fuel.idleDrainRate', message: 'Must be numeric.' });
    }
    if (!num(fuel.warningThreshold)) {
      issues.push({
        path: 'fuel.warningThreshold',
        message: 'Must be numeric.',
      });
    }
  }

  return issues;
}

const createDefaultConfig = (
  physics: LanderDriftPhysicsV1,
  shipPublishedUrl = '',
): LanderDriftConfigV1 => ({
  schemaVersion: LANDER_DRIFT_CONFIG_SCHEMA_VERSION,
  gameId: GAME_ID,
  ship: {
    assetId: SHIP_ASSET_ID,
    publishedUrl: shipPublishedUrl,
    physics,
  },
  landing: {
    safeVerticalSpeed: 2.2,
    maxTiltDegrees: 16,
    padSnapDistance: 12,
  },
  fuel: {
    maxFuel: 100,
    burnRate: 10,
    idleDrainRate: 0.3,
    warningThreshold: 20,
  },
  terrain: {
    degradePerLanding: 2,
    degradePerCrash: 8,
  },
  audio: {
    thrusterFeedback: 'sfx.player.fire',
    landingFeedback: 'sfx.waveClear',
    crashFeedback: 'sfx.explosion.large',
    rescueAndDeliveryFeedback: 'sfx.tierUp',
    fuelAwareness: 'sfx.hit',
    terrainDegradation: 'sfx.explosion.medium',
    music: 'sfx.enemy.fire',
  },
});

export async function saveDraftShipAsset(args: {
  file: File;
  draftName: string;
  physics: LanderDriftPhysicsV1;
  actor: Actor;
}): Promise<{ draftVersionId: string }> {
  const now = nowIso();
  const draftVersionId = randomUUID();
  const ext = inferImageExtension(args.file.name, args.file.type);
  const draftKey = shipDraftS3Key(draftVersionId, ext);
  const bytes = Buffer.from(await args.file.arrayBuffer());
  const dimensions = imageSize(bytes);

  if (DRAFT_BUCKET) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: DRAFT_BUCKET,
        Key: draftKey,
        Body: bytes,
        ContentType: args.file.type || 'image/png',
        ContentLength: bytes.byteLength,
      }),
    );
  } else if (process.env.NODE_ENV !== 'development') {
    throw new Error('draft_bucket_not_configured');
  }

  const inlineDataUrl =
    !DRAFT_BUCKET && process.env.NODE_ENV === 'development'
      ? `data:${args.file.type};base64,${bytes.toString('base64')}`
      : undefined;

  const currentMeta =
    (await getMeta<ShipAssetMeta>(ASSET_PK)) ??
    ({
      entityType: 'LanderShipAsset',
      gameId: GAME_ID,
      assetId: SHIP_ASSET_ID,
      type: 'playerShip',
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    } satisfies ShipAssetMeta);

  const nextStatus = currentMeta.currentPublishedVersionId ? 'both' : 'draft';

  const version: ShipAssetVersion = {
    entityType: 'LanderShipAssetVersion',
    gameId: GAME_ID,
    assetId: SHIP_ASSET_ID,
    versionId: draftVersionId,
    state: 'Draft',
    s3Key: DRAFT_BUCKET ? draftKey : undefined,
    inlineDataUrl,
    fileName: args.file.name,
    contentType: args.file.type || 'image/png',
    width: dimensions.width ?? 0,
    height: dimensions.height ?? 0,
    createdAt: now,
    createdBy: args.actor.userId,
    changeNotes: 'Draft ship upload',
  };

  await ddbDocClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: TABLE_NAME,
            Item: { ...version, ...key(ASSET_PK, versionSk(draftVersionId)) },
          },
        },
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              ...currentMeta,
              ...key(ASSET_PK, 'META'),
              status: nextStatus,
              currentDraftVersionId: draftVersionId,
              draftName: args.draftName,
              updatedAt: now,
            },
          },
        },
      ],
    }),
  );

  const baseConfig = createDefaultConfig(args.physics);
  await saveDraftConfig({
    config: baseConfig,
    actor: args.actor,
    changeNotes: 'Updated from player ship draft upload',
  });

  return { draftVersionId };
}

export async function saveDraftConfig(args: {
  config: LanderDriftConfigV1;
  actor: Actor;
  changeNotes?: string;
}): Promise<{ draftVersionId: string }> {
  const issues = validateLanderDriftConfig(args.config);
  if (issues.length > 0) {
    const error = new Error('validation_failed');
    (error as Error & { details?: unknown }).details = issues;
    throw error;
  }

  const now = nowIso();
  const draftVersionId = randomUUID();
  const draftKey = configDraftS3Key(draftVersionId);
  const inlineJson = JSON.stringify(args.config);

  if (DRAFT_BUCKET) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: DRAFT_BUCKET,
        Key: draftKey,
        Body: inlineJson,
        ContentType: 'application/json',
      }),
    );
  } else if (process.env.NODE_ENV !== 'development') {
    throw new Error('draft_bucket_not_configured');
  }

  const doc =
    (await getMeta<ConfigDocMeta>(CONFIG_PK)) ??
    ({
      entityType: 'LanderConfigDoc',
      gameId: GAME_ID,
      docId: CONFIG_DOC_ID,
      schemaVersion: LANDER_DRIFT_CONFIG_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
    } satisfies ConfigDocMeta);

  const version: ConfigDocVersion = {
    entityType: 'LanderConfigDocVersion',
    gameId: GAME_ID,
    docId: CONFIG_DOC_ID,
    versionId: draftVersionId,
    state: 'Draft',
    s3Key: DRAFT_BUCKET ? draftKey : undefined,
    inlineJson: !DRAFT_BUCKET ? inlineJson : undefined,
    config: args.config,
    createdAt: now,
    createdBy: args.actor.userId,
    changeNotes: args.changeNotes?.trim() || 'Draft config update',
  };

  await ddbDocClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: TABLE_NAME,
            Item: { ...version, ...key(CONFIG_PK, versionSk(draftVersionId)) },
          },
        },
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              ...doc,
              ...key(CONFIG_PK, 'META'),
              currentDraftVersionId: draftVersionId,
              updatedAt: now,
            },
          },
        },
      ],
    }),
  );

  return { draftVersionId };
}

export async function getCurrentPublishStatus(): Promise<PublishStatus> {
  const shipMeta = await getMeta<ShipAssetMeta>(ASSET_PK);
  const configDoc = await getMeta<ConfigDocMeta>(CONFIG_PK);
  const shipDraftVersionId = shipMeta?.currentDraftVersionId;
  const configDraftVersionId = configDoc?.currentDraftVersionId;

  let draftConfig: LanderDriftConfigV1 | undefined;
  const validationIssues: Array<{ path: string; message: string }> = [];
  if (configDraftVersionId) {
    const configDraft = await getVersion<ConfigDocVersion>(
      CONFIG_PK,
      configDraftVersionId,
    );
    draftConfig = configDraft?.config;
    validationIssues.push(...validateLanderDriftConfig(configDraft?.config));
  }

  let readiness: PublishStatus['readiness'];
  if (!shipDraftVersionId) {
    readiness = {
      state: 'missing_ship_asset',
      message: 'Missing ship asset',
      validationIssues: [],
    };
  } else if (!configDraftVersionId) {
    readiness = {
      state: 'missing_config',
      message: 'Missing config',
      validationIssues: [],
    };
  } else if (validationIssues.length > 0) {
    readiness = {
      state: 'validation_failed',
      message: 'Validation failed',
      validationIssues,
    };
  } else {
    readiness = {
      state: 'ready',
      message: 'Ready to publish',
      validationIssues: [],
    };
  }

  return {
    gameId: GAME_ID,
    ship: {
      hasDraft: Boolean(shipMeta?.currentDraftVersionId),
      hasPublished: Boolean(shipMeta?.currentPublishedVersionId),
      currentDraftVersionId: shipMeta?.currentDraftVersionId,
      currentPublishedVersionId: shipMeta?.currentPublishedVersionId,
      lastPublishedAt: shipMeta?.lastPublishedAt,
    },
    config: {
      hasDraft: Boolean(configDoc?.currentDraftVersionId),
      hasPublished: Boolean(configDoc?.currentPublishedVersionId),
      currentDraftVersionId: configDoc?.currentDraftVersionId,
      currentPublishedVersionId: configDoc?.currentPublishedVersionId,
    },
    readiness,
    draftConfig,
  };
}

const defaultPhysics = (): LanderDriftPhysicsV1 => ({
  mass: 1,
  thrust: 20,
  rotationSpeed: 4,
  damping: 0.08,
});

export async function getDraftShipSnapshot(): Promise<DraftShipSnapshot | null> {
  const shipMeta = await getMeta<ShipAssetMeta>(ASSET_PK);
  if (!shipMeta?.currentDraftVersionId) return null;
  const draft = await getVersion<ShipAssetVersion>(
    ASSET_PK,
    shipMeta.currentDraftVersionId,
  );
  if (!draft) return null;
  return {
    draftVersionId: draft.versionId,
    draftName: shipMeta.draftName ?? 'Player Ship',
    fileName: draft.fileName,
    contentType: draft.contentType,
    s3Key: draft.s3Key,
    inlineDataUrl: draft.inlineDataUrl,
  };
}

export async function publishLanderDrift(args: {
  actor: Actor;
  changeNotes?: string;
}): Promise<LanderDriftPublishResponse> {
  const shipMeta = await getMeta<ShipAssetMeta>(ASSET_PK);
  const configDoc = await getMeta<ConfigDocMeta>(CONFIG_PK);
  if (!shipMeta?.currentDraftVersionId) {
    throw new Error('missing_ship_asset');
  }
  if (!configDoc?.currentDraftVersionId) {
    throw new Error('missing_config');
  }

  const draftShip = await getVersion<ShipAssetVersion>(
    ASSET_PK,
    shipMeta.currentDraftVersionId,
  );
  const draftConfigVersion = await getVersion<ConfigDocVersion>(
    CONFIG_PK,
    configDoc.currentDraftVersionId,
  );
  if (!draftShip) throw new Error('missing_ship_asset');
  if (!draftConfigVersion?.config) throw new Error('missing_config');

  const validationIssues = validateLanderDriftConfig(draftConfigVersion.config);
  if (validationIssues.length > 0) {
    const error = new Error('validation_failed');
    (error as Error & { details?: unknown }).details = validationIssues;
    throw error;
  }

  const now = nowIso();
  const publishedAssetVersionId = randomUUID();
  const shipExt = inferImageExtension(
    draftShip.fileName,
    draftShip.contentType,
  );
  const publishedShipKey = shipPublishedS3Key(publishedAssetVersionId, shipExt);

  if (DRAFT_BUCKET && PUBLISHED_BUCKET && draftShip.s3Key) {
    await s3Client.send(
      new CopyObjectCommand({
        Bucket: PUBLISHED_BUCKET,
        Key: publishedShipKey,
        CopySource: `${DRAFT_BUCKET}/${draftShip.s3Key}`,
        MetadataDirective: 'COPY',
      }),
    );
  } else if (PUBLISHED_BUCKET && draftShip.inlineDataUrl) {
    const [, data] = draftShip.inlineDataUrl.split(',');
    await s3Client.send(
      new PutObjectCommand({
        Bucket: PUBLISHED_BUCKET,
        Key: publishedShipKey,
        Body: Buffer.from(data || '', 'base64'),
        ContentType: draftShip.contentType || 'image/png',
      }),
    );
  } else if (process.env.NODE_ENV !== 'development') {
    throw new Error('ship_publish_binary_missing');
  }

  const publishedShipUrl =
    PUBLISHED_BUCKET || ASSETS_PUBLIC_BASE_URL
      ? toPublicUrl(publishedShipKey)
      : (draftShip.inlineDataUrl ?? '');

  const publishedConfigVersionId = randomUUID();
  const publishedConfigKey = configPublishedS3Key(publishedConfigVersionId);
  const publishedConfig: LanderDriftConfigV1 = {
    ...draftConfigVersion.config,
    ship: {
      ...draftConfigVersion.config.ship,
      assetId: SHIP_ASSET_ID,
      publishedUrl: publishedShipUrl,
    },
  };
  const publishedJson = JSON.stringify(publishedConfig);

  if (PUBLISHED_BUCKET) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: PUBLISHED_BUCKET,
        Key: publishedConfigKey,
        Body: publishedJson,
        ContentType: 'application/json',
      }),
    );
  } else if (process.env.NODE_ENV !== 'development') {
    throw new Error('published_bucket_not_configured');
  }

  const publishedShipVersion: ShipAssetVersion = {
    ...draftShip,
    versionId: publishedAssetVersionId,
    state: 'Published',
    s3Key: PUBLISHED_BUCKET ? publishedShipKey : undefined,
    inlineDataUrl: !PUBLISHED_BUCKET ? draftShip.inlineDataUrl : undefined,
    createdAt: now,
    createdBy: args.actor.userId,
    changeNotes: args.changeNotes?.trim() || 'Published from draft',
    derivedFromVersionId: draftShip.versionId,
  };

  const publishedConfigVersion: ConfigDocVersion = {
    ...draftConfigVersion,
    versionId: publishedConfigVersionId,
    state: 'Published',
    s3Key: PUBLISHED_BUCKET ? publishedConfigKey : undefined,
    inlineJson: !PUBLISHED_BUCKET ? publishedJson : undefined,
    config: publishedConfig,
    createdAt: now,
    createdBy: args.actor.userId,
    changeNotes: args.changeNotes?.trim() || 'Published from draft',
    derivedFromVersionId: draftConfigVersion.versionId,
  };

  await ddbDocClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              ...publishedShipVersion,
              ...key(ASSET_PK, versionSk(publishedAssetVersionId)),
            },
          },
        },
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              ...shipMeta,
              ...key(ASSET_PK, 'META'),
              currentPublishedVersionId: publishedAssetVersionId,
              status: shipMeta.currentDraftVersionId ? 'both' : 'published',
              lastPublishedAt: now,
              updatedAt: now,
            },
          },
        },
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              ...publishedConfigVersion,
              ...key(CONFIG_PK, versionSk(publishedConfigVersionId)),
            },
          },
        },
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              ...configDoc,
              ...key(CONFIG_PK, 'META'),
              currentPublishedVersionId: publishedConfigVersionId,
              lastPublishedAt: now,
              updatedAt: now,
            },
          },
        },
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              entityType: 'LanderPublishEvent',
              gameId: GAME_ID,
              publishedAt: now,
              publishedAssetVersionId,
              publishedConfigVersionId,
              actorUserId: args.actor.userId,
              actorEmail: args.actor.email,
              changeNotes: args.changeNotes?.trim() || '',
              ...key(PUBLISH_PK, `EVENT#${now}#${randomUUID()}`),
            },
          },
        },
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              entityType: 'LanderPublishLatest',
              gameId: GAME_ID,
              publishedAt: now,
              publishedAssetVersionId,
              publishedConfigVersionId,
              ...key(PUBLISH_PK, 'LATEST'),
            },
          },
        },
      ],
    }),
  );

  return {
    ok: true,
    gameId: GAME_ID,
    publishedAssetVersionId,
    publishedConfigVersionId,
    publishedAt: now,
  };
}

export async function getPublishedLanderDriftConfig(
  includeDraftFallbackInDev: boolean,
): Promise<LanderDriftConfigV1 | null> {
  const configDoc = await getMeta<ConfigDocMeta>(CONFIG_PK);
  const publishedId = configDoc?.currentPublishedVersionId;
  if (publishedId) {
    const published = await getVersion<ConfigDocVersion>(
      CONFIG_PK,
      publishedId,
    );
    return published?.config ?? null;
  }

  // Dev-only fallback: lets local web preview without requiring a publish first.
  if (includeDraftFallbackInDev && process.env.NODE_ENV === 'development') {
    const draftId = configDoc?.currentDraftVersionId;
    if (!draftId) return null;
    const draft = await getVersion<ConfigDocVersion>(CONFIG_PK, draftId);
    return draft?.config ?? null;
  }

  return null;
}

export async function resolveLanderDriftConfigForSource(
  source: LanderDriftConfigSource,
): Promise<ResolvedLanderDriftConfig> {
  const shipMeta = await getMeta<ShipAssetMeta>(ASSET_PK);
  const configDoc = await getMeta<ConfigDocMeta>(CONFIG_PK);
  const draftVersionId = configDoc?.currentDraftVersionId;
  const publishedVersionId = configDoc?.currentPublishedVersionId;
  const draftConfigVersion = draftVersionId
    ? await getVersion<ConfigDocVersion>(CONFIG_PK, draftVersionId)
    : null;
  const publishedConfigVersion = publishedVersionId
    ? await getVersion<ConfigDocVersion>(CONFIG_PK, publishedVersionId)
    : null;
  const draftShipVersion = shipMeta?.currentDraftVersionId
    ? await getVersion<ShipAssetVersion>(
        ASSET_PK,
        shipMeta.currentDraftVersionId,
      )
    : null;
  const publishedShipVersion = shipMeta?.currentPublishedVersionId
    ? await getVersion<ShipAssetVersion>(
        ASSET_PK,
        shipMeta.currentPublishedVersionId,
      )
    : null;

  const shipVersionToRuntimeUrl = (
    version: ShipAssetVersion | null,
  ): string | undefined => {
    if (!version) return undefined;
    if (version.inlineDataUrl) return version.inlineDataUrl;
    if (!version.s3Key) return undefined;
    if (version.s3Key.includes('/draft/')) {
      return `/api/admin/games/lander-drift/draft/ship/file?key=${encodeURIComponent(
        version.s3Key,
      )}`;
    }
    if (ASSETS_PUBLIC_BASE_URL) {
      return toPublicUrl(version.s3Key);
    }
    return undefined;
  };

  const availableSources = {
    draft: draftConfigVersion?.config
      ? { enabled: true as const }
      : {
          enabled: false as const,
          reason: 'No draft config available.',
        },
    published: publishedConfigVersion?.config
      ? { enabled: true as const }
      : {
          enabled: false as const,
          reason: 'No published config available.',
        },
    defaults: { enabled: true as const },
  };

  const sourceWithFallback: LanderDriftConfigSource =
    source === 'draft' && !availableSources.draft.enabled
      ? source === 'draft' && availableSources.published.enabled
        ? 'published'
        : 'defaults'
      : source === 'published' && !availableSources.published.enabled
        ? availableSources.draft.enabled
          ? 'draft'
          : 'defaults'
        : source;

  const baseConfig =
    sourceWithFallback === 'draft'
      ? draftConfigVersion?.config
      : sourceWithFallback === 'published'
        ? publishedConfigVersion?.config
        : undefined;

  if (baseConfig) {
    const preferredShipUrl =
      sourceWithFallback === 'draft'
        ? shipVersionToRuntimeUrl(draftShipVersion)
        : sourceWithFallback === 'published'
          ? shipVersionToRuntimeUrl(publishedShipVersion)
          : undefined;

    return {
      source: sourceWithFallback,
      config: {
        ...baseConfig,
        ship: {
          ...baseConfig.ship,
          // Test mode should always use the current ship asset for the selected source.
          publishedUrl: preferredShipUrl ?? baseConfig.ship.publishedUrl,
        },
      },
      availableSources,
    };
  }

  const physics =
    draftConfigVersion?.config?.ship?.physics ??
    publishedConfigVersion?.config?.ship?.physics ??
    defaultPhysics();
  const config = createDefaultConfig(
    physics,
    shipVersionToRuntimeUrl(draftShipVersion) ??
      shipVersionToRuntimeUrl(publishedShipVersion) ??
      '',
  );

  return {
    source: 'defaults',
    config,
    availableSources,
  };
}

export async function getLatestPublishMetadata(): Promise<{
  publishedAt?: string;
  publishedAssetVersionId?: string;
  publishedConfigVersionId?: string;
}> {
  const res = await ddbDocClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: key(PUBLISH_PK, 'LATEST'),
    }),
  );
  if (!res.Item) return {};
  return {
    publishedAt: res.Item.publishedAt as string | undefined,
    publishedAssetVersionId: res.Item.publishedAssetVersionId as
      | string
      | undefined,
    publishedConfigVersionId: res.Item.publishedConfigVersionId as
      | string
      | undefined,
  };
}

export async function listRecentPublishEvents(limit = 10): Promise<
  Array<{
    publishedAt: string;
    publishedAssetVersionId: string;
    publishedConfigVersionId: string;
    actorEmail?: string;
    changeNotes?: string;
  }>
> {
  const res = await ddbDocClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :prefix)',
      ExpressionAttributeNames: {
        '#pk': PK_ATTR,
        '#sk': SK_ATTR,
      },
      ExpressionAttributeValues: {
        ':pk': PUBLISH_PK,
        ':prefix': 'EVENT#',
      },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );

  return (res.Items ?? []).map((item) => ({
    publishedAt: item.publishedAt as string,
    publishedAssetVersionId: item.publishedAssetVersionId as string,
    publishedConfigVersionId: item.publishedConfigVersionId as string,
    actorEmail: item.actorEmail as string | undefined,
    changeNotes: item.changeNotes as string | undefined,
  }));
}
