import { NextResponse } from 'next/server';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient } from '../../../../../lib/ddb';
import type { CoreAssetDefinition } from '../../../../../src/lib/coreAssets';

export const runtime = 'nodejs';

const CORE_ASSETS_TABLE =
  process.env.DDB_TABLE_GAME_CORE_ASSETS ?? 'PlaymastersGameAssets';
const PK_ATTR = process.env.DDB_PK_NAME_GAME_CORE_ASSETS || 'PK';
const SK_ATTR = process.env.DDB_SK_NAME_GAME_CORE_ASSETS || 'SK';

type EnemyRecord = {
  enemyId: string;
  displayName?: string;
  spriteKey?: string;
  hp?: number;
};

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const gameId = url.searchParams.get('gameId')?.trim() || 'space-blaster';
    const res = await ddbDocClient.send(
      new QueryCommand({
        TableName: CORE_ASSETS_TABLE,
        KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :prefix)',
        ExpressionAttributeNames: {
          '#pk': PK_ATTR,
          '#sk': SK_ATTR,
        },
        ExpressionAttributeValues: {
          ':pk': gameId,
          ':prefix': 'enemy.',
        },
      }),
    );
    const enemies: EnemyRecord[] = (res.Items ?? [])
      .flatMap((item) => {
        const definition = item.definition as CoreAssetDefinition | undefined;
        const definitionId =
          typeof item[SK_ATTR] === 'string' ? (item[SK_ATTR] as string) : '';
        if (!definition || !definitionId.startsWith('enemy.')) return [];
        const enemyId = definitionId.replace(/^enemy\./, '');
        return [
          {
            enemyId,
            displayName: definition.displayName ?? enemyId,
            spriteKey: definition.slots.find(
              (slot) => slot.slotId === 'spriteKey',
            )?.file?.objectKey,
            hp:
              typeof definition.variables?.hp === 'number'
                ? definition.variables.hp
                : undefined,
          },
        ];
      })
      .sort((left, right) => left.enemyId.localeCompare(right.enemyId));
    return NextResponse.json({ enemies });
  } catch (err) {
    console.error('enemy_catalog_read_error', err);
    const name = (err as { name?: string }).name;
    const type = (err as { __type?: string }).__type;
    const isMissingTable =
      name === 'ResourceNotFoundException' ||
      type === 'com.amazonaws.dynamodb.v20120810#ResourceNotFoundException';
    if (isMissingTable) {
      return NextResponse.json({ enemies: [] });
    }
    return bad('catalog_failed', 500);
  }
}
