import {
  PutCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { ddbDocClient } from './ddb';

export type AssetUsage = {
  assetId: string;
  usageType: 'level-background' | 'game-splash' | 'game-logo' | string;
  refId: string;
  createdAt: string;
};

const USAGE_TABLE = process.env.DDB_TABLE_ASSET_USAGE ?? 'PlaymastersAssetUsage';
const PK_ATTR = process.env.DDB_PK_NAME_USAGE || process.env.DDB_PK_NAME || 'PK';
const SK_ATTR = process.env.DDB_SK_NAME_USAGE || process.env.DDB_SK_NAME || 'SK';

const usageKey = (assetId: string, refId: string) => ({
  [PK_ATTR]: `ASSET#${assetId}`,
  [SK_ATTR]: refId,
});

export async function upsertUsage(
  assetId: string,
  refId: string,
  usageType: AssetUsage['usageType']
) {
  const now = new Date().toISOString();
  await ddbDocClient.send(
    new PutCommand({
      TableName: USAGE_TABLE,
      Item: {
        ...usageKey(assetId, refId),
        assetId,
        refId,
        usageType,
        createdAt: now,
      },
    })
  );
}

export async function removeUsage(assetId: string, refId: string) {
  await ddbDocClient.send(
    new DeleteCommand({
      TableName: USAGE_TABLE,
      Key: usageKey(assetId, refId),
    })
  );
}

export async function listAssetUsage(assetId: string): Promise<AssetUsage[]> {
  const res = await ddbDocClient.send(
    new QueryCommand({
      TableName: USAGE_TABLE,
      KeyConditionExpression: `${PK_ATTR} = :pk`,
      ExpressionAttributeValues: { ':pk': `ASSET#${assetId}` },
    })
  );
  const items = (res.Items ?? []) as any[];
  return items.map((i) => ({
    assetId: i.assetId,
    refId: i.refId,
    usageType: i.usageType,
    createdAt: i.createdAt,
  }));
}

export async function countAssetUsage(assetId: string): Promise<number> {
  const res = await ddbDocClient.send(
    new QueryCommand({
      TableName: USAGE_TABLE,
      KeyConditionExpression: `${PK_ATTR} = :pk`,
      ExpressionAttributeValues: { ':pk': `ASSET#${assetId}` },
      Select: 'COUNT',
    })
  );
  return res.Count ?? 0;
}
