import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import type { LeaderboardState } from '@playmasters/types';

const region = process.env.AWS_REGION;
const endpoint = process.env.DDB_ENDPOINT;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

const SNAPSHOT_TABLE = process.env.DDB_TABLE_LEADERBOARD_SNAPSHOTS;
const PK_ATTR = process.env.DDB_PK_NAME || 'PK';
const SK_ATTR = process.env.DDB_SK_NAME || 'SK';

export const snapshotsEnabled = Boolean(SNAPSHOT_TABLE && region);

const baseClient = snapshotsEnabled
  ? new DynamoDBClient({
      region,
      endpoint: endpoint || undefined,
      credentials:
        accessKeyId && secretAccessKey
          ? {
              accessKeyId,
              secretAccessKey,
            }
          : undefined,
    })
  : null;

export const ddbDocClient = baseClient
  ? DynamoDBDocumentClient.from(baseClient, { marshallOptions: { removeUndefinedValues: true } })
  : null;

const buildPk = (state: LeaderboardState) =>
  state.scope === 'global'
    ? `GAME#${state.gameId}#SCOPE#GLOBAL`
    : `GAME#${state.gameId}#SCOPE#COUNTRY#${state.countryCode ?? 'ZZ'}`;

export async function putSnapshots(states: LeaderboardState[]) {
  if (!ddbDocClient || !SNAPSHOT_TABLE) return;

  await Promise.all(
    states.map((state) =>
      ddbDocClient.send(
        new PutCommand({
          TableName: SNAPSHOT_TABLE,
          Item: {
            [PK_ATTR]: buildPk(state),
            [SK_ATTR]: 'SNAPSHOT',
            gameId: state.gameId,
            scope: state.scope,
            countryCode: state.countryCode,
            entries: state.entries,
            updatedAt: state.updatedAt,
          },
        })
      )
    )
  );
}

export async function scanSnapshots(): Promise<LeaderboardState[]> {
  if (!ddbDocClient || !SNAPSHOT_TABLE) return [];

  const res = await ddbDocClient.send(
    new ScanCommand({
      TableName: SNAPSHOT_TABLE,
    })
  );

  return (res.Items ?? []).map((item) => ({
    gameId: item.gameId as string,
    scope: item.scope as LeaderboardState['scope'],
    countryCode: item.countryCode as string | undefined,
    entries: (item.entries as LeaderboardState['entries']) ?? [],
    updatedAt: (item.updatedAt as string) ?? new Date(0).toISOString(),
  }));
}
