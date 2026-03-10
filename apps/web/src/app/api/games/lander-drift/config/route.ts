import { NextResponse } from 'next/server';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient } from '../../../../../lib/ddb';
import type { LanderDriftConfigV1 } from '@playmasters/types';

export const runtime = 'nodejs';

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
const CONFIG_PK = 'GAME#lander-drift#CONFIG#main';

const key = (pkValue: string, skValue: string) => ({
  [PK_ATTR]: pkValue,
  [SK_ATTR]: skValue,
});

type ConfigDocMeta = {
  currentDraftVersionId?: string;
  currentPublishedVersionId?: string;
};

type ConfigVersion = {
  config?: LanderDriftConfigV1;
};

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

async function getMeta(): Promise<ConfigDocMeta | null> {
  const res = await ddbDocClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: key(CONFIG_PK, 'META'),
    }),
  );
  if (!res.Item) return null;
  return res.Item as ConfigDocMeta;
}

async function getVersion(versionId: string): Promise<ConfigVersion | null> {
  const res = await ddbDocClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: key(CONFIG_PK, `VERSION#${versionId}`),
    }),
  );
  if (!res.Item) return null;
  return res.Item as ConfigVersion;
}

export async function GET() {
  try {
    const meta = await getMeta();
    if (!meta) return bad('config_not_found', 404);

    if (meta.currentPublishedVersionId) {
      const published = await getVersion(meta.currentPublishedVersionId);
      if (published?.config) {
        return NextResponse.json(published.config, {
          headers: {
            'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
          },
        });
      }
    }

    // Dev-only fallback allows local gameplay before first explicit publish.
    if (process.env.NODE_ENV === 'development' && meta.currentDraftVersionId) {
      const draft = await getVersion(meta.currentDraftVersionId);
      if (draft?.config) {
        return NextResponse.json(draft.config, {
          headers: {
            'Cache-Control': 'no-store',
            'X-Playmasters-Config-Source': 'draft-fallback',
          },
        });
      }
    }

    return bad('published_config_not_found', 404);
  } catch (err) {
    console.error('lander_drift_public_config_failed', err);
    return bad('config_load_failed', 500);
  }
}
