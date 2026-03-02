import {
  GetCommand,
  PutCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { ddbDocClient } from './ddb';

const BUNDLE_TABLE =
  process.env.DDB_TABLE_SB_BUNDLES ?? 'PlaymastersSpaceBlasterBundles';
const PK_ATTR = process.env.DDB_PK_NAME_SB_BUNDLES || 'PK';
const SK_ATTR = process.env.DDB_SK_NAME_SB_BUNDLES || 'SK';
const FALLBACK_TABLE =
  process.env.DDB_TABLE_GAME_CORE_ASSETS ?? 'PlaymastersGameAssets';
const FALLBACK_PK_ATTR = process.env.DDB_PK_NAME_GAME_CORE_ASSETS || 'PK';
const FALLBACK_SK_ATTR = process.env.DDB_SK_NAME_GAME_CORE_ASSETS || 'SK';

const memoryBundleByVersion = new Map<string, PublishedBundle>();
const memoryPointerByEnv = new Map<string, BundlePointer>();

const isMissingTableError = (err: unknown): boolean => {
  const name = (err as { name?: string }).name;
  const type = (err as { __type?: string }).__type;
  return (
    name === 'ResourceNotFoundException' ||
    type === 'com.amazonaws.dynamodb.v20120810#ResourceNotFoundException'
  );
};

const isVersionAlreadyExistsTxCancel = (err: unknown): boolean => {
  const name = (err as { name?: string }).name;
  const type = (err as { __type?: string }).__type;
  if (
    name !== 'TransactionCanceledException' &&
    type !== 'com.amazonaws.dynamodb.v20120810#TransactionCanceledException'
  ) {
    return false;
  }
  const reasons = (err as { CancellationReasons?: Array<{ Code?: string }> })
    .CancellationReasons;
  if (!Array.isArray(reasons) || reasons.length === 0) return false;
  // First transact item is the version Put with "attribute_not_exists" condition.
  return reasons[0]?.Code === 'ConditionalCheckFailed';
};

const versionMapKey = (env: string, versionId: string) =>
  `${env}::${versionId}`;

export type PublishedBundle = {
  env: string;
  versionId: string;
  configHash: string;
  versionHash?: string;
  bundle: unknown;
  createdAt: string;
};

export type BundlePointer = {
  env: string;
  currentVersionId: string;
  updatedAt?: string;
};

const pointerKey = (env: string) => ({
  [PK_ATTR]: `BUNDLE#${env}`,
  [SK_ATTR]: 'POINTER',
});

const versionKey = (env: string, versionId: string) => ({
  [PK_ATTR]: `BUNDLE#${env}`,
  [SK_ATTR]: `VERSION#${versionId}`,
});

const fallbackPointerKey = (env: string) => ({
  [FALLBACK_PK_ATTR]: gameScopeKey(),
  [FALLBACK_SK_ATTR]: `bundle.pointer.${env}`,
});

const fallbackVersionKey = (env: string, versionId: string) => ({
  [FALLBACK_PK_ATTR]: gameScopeKey(),
  [FALLBACK_SK_ATTR]: `bundle.version.${env}.${versionId}`,
});

const gameScopeKey = () => 'space-blaster';

export async function getCurrentBundle(
  env: string,
): Promise<PublishedBundle | null> {
  const pointer = await getBundlePointer(env);
  const currentVersion = pointer?.currentVersionId;
  if (!currentVersion) return null;
  let version;
  try {
    version = await ddbDocClient.send(
      new GetCommand({
        TableName: BUNDLE_TABLE,
        Key: versionKey(env, currentVersion),
      }),
    );
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
    const fallbackVersion = await ddbDocClient.send(
      new GetCommand({
        TableName: FALLBACK_TABLE,
        Key: fallbackVersionKey(env, currentVersion),
      }),
    );
    if (!fallbackVersion.Item) {
      return (
        memoryBundleByVersion.get(versionMapKey(env, currentVersion)) ?? null
      );
    }
    return (
      (fallbackVersion.Item.bundleVersion as PublishedBundle | undefined) ??
      null
    );
  }
  if (!version.Item) return null;
  const { [PK_ATTR]: _pk, [SK_ATTR]: _sk, ...rest } = version.Item;
  void _pk;
  void _sk;
  return rest as PublishedBundle;
}

export async function getBundlePointer(
  env: string,
): Promise<BundlePointer | null> {
  let pointer;
  try {
    pointer = await ddbDocClient.send(
      new GetCommand({
        TableName: BUNDLE_TABLE,
        Key: pointerKey(env),
      }),
    );
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
    const fallbackPointer = await ddbDocClient.send(
      new GetCommand({
        TableName: FALLBACK_TABLE,
        Key: fallbackPointerKey(env),
      }),
    );
    const fallbackVersionId = fallbackPointer.Item?.currentVersionId as
      | string
      | undefined;
    if (!fallbackVersionId) return memoryPointerByEnv.get(env) ?? null;
    return {
      env,
      currentVersionId: fallbackVersionId,
      updatedAt: fallbackPointer.Item?.updatedAt as string | undefined,
    };
  }
  const currentVersionId = pointer.Item?.currentVersionId as string | undefined;
  if (!currentVersionId) return null;

  return {
    env,
    currentVersionId,
    updatedAt: pointer.Item?.updatedAt as string | undefined,
  };
}

export async function publishBundle(input: {
  env: string;
  configHash: string;
  versionHash?: string;
  bundle: unknown;
  previousVersionId?: string | null;
}): Promise<PublishedBundle> {
  const { env, configHash } = input;
  const versionId = input.configHash;
  const createdAt = new Date().toISOString();
  const item: PublishedBundle & { [key: string]: unknown } = {
    env,
    versionId,
    configHash,
    ...(input.versionHash ? { versionHash: input.versionHash } : {}),
    bundle: input.bundle,
    createdAt,
    ...versionKey(env, versionId),
  };

  const pointerUpdate = {
    Update: {
      TableName: BUNDLE_TABLE,
      Key: pointerKey(env),
      UpdateExpression: 'SET currentVersionId = :vid, updatedAt = :ts',
      ExpressionAttributeValues: {
        ':vid': versionId,
        ':ts': createdAt,
      },
    },
  };

  try {
    await ddbDocClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: BUNDLE_TABLE,
              Item: item,
              ConditionExpression:
                'attribute_not_exists(#pk) AND attribute_not_exists(#sk)',
              ExpressionAttributeNames: { '#pk': PK_ATTR, '#sk': SK_ATTR },
            },
          },
          pointerUpdate,
        ],
      }),
    );
  } catch (err) {
    if (isVersionAlreadyExistsTxCancel(err)) {
      // Idempotent publish path: version row already exists. Update pointer only.
      try {
        await ddbDocClient.send(
          new PutCommand({
            TableName: BUNDLE_TABLE,
            Item: {
              ...pointerKey(env),
              env,
              currentVersionId: versionId,
              updatedAt: createdAt,
            },
          }),
        );
      } catch (pointerErr) {
        if (!isMissingTableError(pointerErr)) throw pointerErr;
        await ddbDocClient.send(
          new PutCommand({
            TableName: FALLBACK_TABLE,
            Item: {
              ...fallbackPointerKey(env),
              entityType: 'bundlePointer',
              env,
              gameId: gameScopeKey(),
              currentVersionId: versionId,
              updatedAt: createdAt,
            },
          }),
        );
      }
    } else if (!isMissingTableError(err)) {
      throw err;
    } else {
      await ddbDocClient.send(
        new PutCommand({
          TableName: FALLBACK_TABLE,
          Item: {
            ...fallbackVersionKey(env, versionId),
            entityType: 'bundleVersion',
            env,
            gameId: gameScopeKey(),
            versionId,
            bundleVersion: item as PublishedBundle,
            updatedAt: createdAt,
          },
        }),
      );
      await ddbDocClient.send(
        new PutCommand({
          TableName: FALLBACK_TABLE,
          Item: {
            ...fallbackPointerKey(env),
            entityType: 'bundlePointer',
            env,
            gameId: gameScopeKey(),
            currentVersionId: versionId,
            updatedAt: createdAt,
          },
        }),
      );
    }
  }

  const published = item as PublishedBundle;
  memoryBundleByVersion.set(versionMapKey(env, versionId), published);
  memoryPointerByEnv.set(env, {
    env,
    currentVersionId: versionId,
    updatedAt: createdAt,
  });
  return published;
}

export async function getBundleVersion(
  env: string,
  versionId: string,
): Promise<PublishedBundle | null> {
  let res;
  try {
    res = await ddbDocClient.send(
      new GetCommand({
        TableName: BUNDLE_TABLE,
        Key: versionKey(env, versionId),
      }),
    );
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
    const fallback = await ddbDocClient.send(
      new GetCommand({
        TableName: FALLBACK_TABLE,
        Key: fallbackVersionKey(env, versionId),
      }),
    );
    if (!fallback.Item)
      return memoryBundleByVersion.get(versionMapKey(env, versionId)) ?? null;
    return (fallback.Item.bundleVersion as PublishedBundle | undefined) ?? null;
  }
  if (!res.Item) return null;
  const { [PK_ATTR]: _pk, [SK_ATTR]: _sk, ...rest } = res.Item;
  void _pk;
  void _sk;
  return rest as PublishedBundle;
}

export async function rollbackBundle(input: {
  env: string;
  targetVersionId: string;
}): Promise<{ prevVersionId: string | null; newVersionId: string }> {
  const { env, targetVersionId } = input;
  let prevVersionId: string | null = null;
  try {
    const pointer = await ddbDocClient.send(
      new GetCommand({
        TableName: BUNDLE_TABLE,
        Key: pointerKey(env),
      }),
    );
    prevVersionId =
      (pointer.Item?.currentVersionId as string | undefined) ?? null;
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
    const fallbackPointer = await ddbDocClient.send(
      new GetCommand({
        TableName: FALLBACK_TABLE,
        Key: fallbackPointerKey(env),
      }),
    );
    prevVersionId =
      (fallbackPointer.Item?.currentVersionId as string | undefined) ??
      memoryPointerByEnv.get(env)?.currentVersionId ??
      null;
  }

  const target = await getBundleVersion(env, targetVersionId);
  if (!target) throw new Error('target_not_found');

  const updatedAt = new Date().toISOString();
  try {
    await ddbDocClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: BUNDLE_TABLE,
              Key: pointerKey(env),
              UpdateExpression: 'SET currentVersionId = :vid, updatedAt = :ts',
              ConditionExpression:
                prevVersionId === null
                  ? 'attribute_not_exists(currentVersionId)'
                  : 'currentVersionId = :prev',
              ExpressionAttributeValues: {
                ':vid': targetVersionId,
                ':ts': updatedAt,
                ...(prevVersionId !== null ? { ':prev': prevVersionId } : {}),
              },
            },
          },
        ],
      }),
    );
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
    await ddbDocClient.send(
      new PutCommand({
        TableName: FALLBACK_TABLE,
        Item: {
          ...fallbackPointerKey(env),
          entityType: 'bundlePointer',
          env,
          gameId: gameScopeKey(),
          currentVersionId: targetVersionId,
          updatedAt,
        },
      }),
    );
    memoryPointerByEnv.set(env, {
      env,
      currentVersionId: targetVersionId,
      updatedAt,
    });
  }

  return { prevVersionId, newVersionId: targetVersionId };
}
