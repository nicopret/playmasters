import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient } from './ddb';

const BUNDLE_TABLE =
  process.env.DDB_TABLE_SB_BUNDLES ??
  process.env.DDB_TABLE_SPACE_BLASTER ??
  'PlaymastersSpaceBlasterBundles';
const PK_ATTR =
  process.env.DDB_PK_NAME_SB_BUNDLES || process.env.DDB_PK_NAME || 'PK';
const SK_ATTR =
  process.env.DDB_SK_NAME_SB_BUNDLES || process.env.DDB_SK_NAME || 'SK';

export type PublishedBundle = {
  env: string;
  versionId: string;
  configHash: string;
  bundle: unknown;
  createdAt: string;
};

const pointerKey = (env: string) => ({
  [PK_ATTR]: `BUNDLE#${env}`,
  [SK_ATTR]: 'POINTER',
});

const versionKey = (env: string, versionId: string) => ({
  [PK_ATTR]: `BUNDLE#${env}`,
  [SK_ATTR]: `VERSION#${versionId}`,
});

export async function getCurrentBundle(
  env: string,
): Promise<PublishedBundle | null> {
  const pointer = await ddbDocClient.send(
    new GetCommand({
      TableName: BUNDLE_TABLE,
      Key: pointerKey(env),
    }),
  );
  const currentVersion = pointer.Item?.currentVersionId as string | undefined;
  if (!currentVersion) return null;
  const version = await ddbDocClient.send(
    new GetCommand({
      TableName: BUNDLE_TABLE,
      Key: versionKey(env, currentVersion),
    }),
  );
  if (!version.Item) return null;
  const { [PK_ATTR]: _pk, [SK_ATTR]: _sk, ...rest } = version.Item;
  void _pk;
  void _sk;
  return rest as PublishedBundle;
}

export async function publishBundle(input: {
  env: string;
  configHash: string;
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

  return item;
}

export async function getBundleVersion(
  env: string,
  versionId: string,
): Promise<PublishedBundle | null> {
  const res = await ddbDocClient.send(
    new GetCommand({
      TableName: BUNDLE_TABLE,
      Key: versionKey(env, versionId),
    }),
  );
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
  const pointer = await ddbDocClient.send(
    new GetCommand({
      TableName: BUNDLE_TABLE,
      Key: pointerKey(env),
    }),
  );
  const prevVersionId =
    (pointer.Item?.currentVersionId as string | undefined) ?? null;

  const target = await getBundleVersion(env, targetVersionId);
  if (!target) throw new Error('target_not_found');

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
              ':ts': new Date().toISOString(),
              ...(prevVersionId !== null ? { ':prev': prevVersionId } : {}),
            },
          },
        },
      ],
    }),
  );

  return { prevVersionId, newVersionId: targetVersionId };
}
