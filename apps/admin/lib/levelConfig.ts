import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { ddbDocClient } from './ddb';
import { LevelConfig } from '@playmasters/types';
import { getAsset, getVersion } from './imageAssets';
import { removeUsage, upsertUsage } from './assetUsage';
import { getCoreAssetDefinition } from '../src/lib/coreAssets';

const LEVEL_TABLE =
  process.env.DDB_TABLE_LEVEL_CONFIG ?? 'PlaymastersLevelConfig';
const LEVEL_PK_ATTR = process.env.DDB_PK_NAME_LEVEL_CONFIG || 'PK';
const LEVEL_SK_ATTR = process.env.DDB_SK_NAME_LEVEL_CONFIG || 'SK';
const GAME_ASSETS_TABLE =
  process.env.DDB_TABLE_GAME_CORE_ASSETS ?? 'PlaymastersGameAssets';
const GAME_ASSETS_PK_ATTR = process.env.DDB_PK_NAME_GAME_CORE_ASSETS || 'PK';
const GAME_ASSETS_SK_ATTR = process.env.DDB_SK_NAME_GAME_CORE_ASSETS || 'SK';

const levelKey = (gameId: string, levelId: string) => ({
  [LEVEL_PK_ATTR]: `${gameId}`,
  [LEVEL_SK_ATTR]: `${levelId}`,
});

const fallbackLevelKey = (gameId: string, levelId: string) => ({
  [GAME_ASSETS_PK_ATTR]: gameId,
  [GAME_ASSETS_SK_ATTR]: `level.${levelId}.config`,
});

const isMissingTableError = (err: unknown): boolean => {
  const name = (err as { name?: string }).name;
  const type = (err as { __type?: string }).__type;
  return (
    name === 'ResourceNotFoundException' ||
    type === 'com.amazonaws.dynamodb.v20120810#ResourceNotFoundException'
  );
};

export async function getLevelConfig(
  gameId: string,
  levelId: string,
): Promise<LevelConfig | null> {
  let res;
  try {
    res = await ddbDocClient.send(
      new GetCommand({
        TableName: LEVEL_TABLE,
        Key: levelKey(gameId, levelId),
      }),
    );
  } catch (err) {
    if (isMissingTableError(err)) {
      const fallbackRes = await ddbDocClient.send(
        new GetCommand({
          TableName: GAME_ASSETS_TABLE,
          Key: fallbackLevelKey(gameId, levelId),
        }),
      );
      if (!fallbackRes.Item) return null;
      const fallbackCfg = fallbackRes.Item.levelConfig as
        | LevelConfig
        | undefined;
      if (!fallbackCfg) return null;
      return fallbackCfg;
    }
    throw err;
  }
  if (!res.Item) return null;
  const { [LEVEL_PK_ATTR]: _pk, [LEVEL_SK_ATTR]: _sk, ...rest } = res.Item;
  void _pk;
  void _sk;
  const cfg = rest as LevelConfig;
  if (!cfg.waves) (cfg as LevelConfig & { waves: unknown }).waves = [];
  if (cfg.fleetSpeed === undefined) cfg.fleetSpeed = 0;
  if (cfg.rampFactor === undefined) cfg.rampFactor = 0;
  if (cfg.descendStep === undefined) cfg.descendStep = 0;
  if (cfg.maxConcurrentDivers === undefined) cfg.maxConcurrentDivers = 0;
  if (cfg.maxConcurrentShots === undefined) cfg.maxConcurrentShots = 0;
  if (cfg.attackTickMs === undefined) cfg.attackTickMs = 0;
  if (cfg.diveChancePerTick === undefined) cfg.diveChancePerTick = 0;
  if (cfg.turnRate === undefined) cfg.turnRate = 0;
  if (cfg.fireTickMs === undefined) cfg.fireTickMs = 0;
  if (cfg.fireChancePerTick === undefined) cfg.fireChancePerTick = 0;
  return cfg;
}

export async function listLevelConfigs(gameId: string): Promise<LevelConfig[]> {
  try {
    const res = await ddbDocClient.send(
      new QueryCommand({
        TableName: LEVEL_TABLE,
        KeyConditionExpression: '#pk = :pk',
        ExpressionAttributeNames: {
          '#pk': LEVEL_PK_ATTR,
        },
        ExpressionAttributeValues: {
          ':pk': gameId,
        },
      }),
    );

    return (res.Items ?? [])
      .map((item) => {
        const levelIdValue =
          typeof item[LEVEL_SK_ATTR] === 'string'
            ? (item[LEVEL_SK_ATTR] as string)
            : '';
        const { [LEVEL_PK_ATTR]: _pk, [LEVEL_SK_ATTR]: _sk, ...rest } = item;
        void _pk;
        void _sk;
        const cfg = rest as LevelConfig;
        if (!cfg.gameId) cfg.gameId = gameId;
        if (!cfg.levelId) cfg.levelId = levelIdValue;
        return cfg;
      })
      .filter((cfg) => !!cfg.levelId)
      .sort((left, right) => left.levelId.localeCompare(right.levelId));
  } catch (err) {
    if (!isMissingTableError(err)) {
      throw err;
    }
  }

  const fallbackRes = await ddbDocClient.send(
    new QueryCommand({
      TableName: GAME_ASSETS_TABLE,
      KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :prefix)',
      ExpressionAttributeNames: {
        '#pk': GAME_ASSETS_PK_ATTR,
        '#sk': GAME_ASSETS_SK_ATTR,
      },
      ExpressionAttributeValues: {
        ':pk': gameId,
        ':prefix': 'level.',
      },
    }),
  );

  return (fallbackRes.Items ?? [])
    .map((item) => {
      const levelConfig = item.levelConfig as LevelConfig | undefined;
      const sk =
        typeof item[GAME_ASSETS_SK_ATTR] === 'string'
          ? (item[GAME_ASSETS_SK_ATTR] as string)
          : '';
      const derivedLevelId =
        sk.startsWith('level.') && sk.endsWith('.config')
          ? sk.slice('level.'.length, -'.config'.length)
          : '';
      const cfg =
        levelConfig ?? ({ gameId, levelId: derivedLevelId } as LevelConfig);
      if (!cfg.gameId) cfg.gameId = gameId;
      if (!cfg.levelId) cfg.levelId = derivedLevelId;
      return cfg;
    })
    .filter((cfg) => !!cfg.levelId)
    .sort((left, right) => left.levelId.localeCompare(right.levelId));
}

export async function deleteLevelConfig(
  gameId: string,
  levelId: string,
): Promise<void> {
  const existing = await getLevelConfig(gameId, levelId);

  try {
    await ddbDocClient.send(
      new DeleteCommand({
        TableName: LEVEL_TABLE,
        Key: levelKey(gameId, levelId),
      }),
    );
  } catch (err) {
    if (!isMissingTableError(err)) {
      throw err;
    }
  }

  try {
    await ddbDocClient.send(
      new DeleteCommand({
        TableName: GAME_ASSETS_TABLE,
        Key: fallbackLevelKey(gameId, levelId),
      }),
    );
  } catch (err) {
    if (!isMissingTableError(err)) {
      throw err;
    }
  }

  const refId = `GAME#${gameId}#LEVEL#${levelId}`;
  if (existing?.backgroundAssetId) {
    await removeUsage(existing.backgroundAssetId, refId);
  }
}

export async function saveLevelConfig(input: {
  gameId: string;
  levelId: string;
  layoutId?: string;
  backgroundAssetId?: string;
  backgroundVersionId?: string;
  pinToVersion?: boolean;
  waves?: LevelConfig['waves'];
  formationGrid?: LevelConfig['formationGrid'];
  fleetSpeed?: number;
  rampFactor?: number;
  descendStep?: number;
  maxConcurrentDivers?: number;
  maxConcurrentShots?: number;
  attackTickMs?: number;
  diveChancePerTick?: number;
  divePattern?: string;
  turnRate?: number;
  fireTickMs?: number;
  fireChancePerTick?: number;
}): Promise<LevelConfig> {
  const {
    gameId,
    levelId,
    layoutId,
    backgroundAssetId,
    backgroundVersionId,
    pinToVersion,
    waves,
    formationGrid,
    fleetSpeed,
    rampFactor,
    descendStep,
    maxConcurrentDivers,
    maxConcurrentShots,
    attackTickMs,
    diveChancePerTick,
    divePattern,
    turnRate,
    fireTickMs,
    fireChancePerTick,
  } = input;
  const now = new Date().toISOString();

  const existing = await getLevelConfig(gameId, levelId);

  // basic validation
  if (backgroundAssetId) {
    const levelBackgroundId = `${levelId}.background`;
    if (backgroundAssetId === levelBackgroundId) {
      const definition = await getCoreAssetDefinition({
        gameId,
        definitionId: backgroundAssetId,
      });
      const hasImageFile = !!definition?.slots?.some(
        (slot) =>
          slot.media === 'image' &&
          !!slot.file &&
          (!!slot.file.objectKey || !!slot.file.inlineDataUrl),
      );
      if (!hasImageFile) {
        throw new Error('background_not_found');
      }
    } else {
      const asset = await getAsset(backgroundAssetId);
      if (!asset) throw new Error('background_not_found');
      if (asset.type !== 'background') throw new Error('not_a_background');
      if (backgroundVersionId) {
        const v = await getVersion(backgroundAssetId, backgroundVersionId);
        if (!v || v.state !== 'Published')
          throw new Error('background_version_not_published');
      }
    }
  }

  const item: LevelConfig = {
    gameId,
    levelId,
    layoutId,
    waves: waves ?? [],
    formationGrid,
    backgroundAssetId,
    backgroundVersionId: pinToVersion ? backgroundVersionId : undefined,
    pinnedToVersion: pinToVersion && !!backgroundVersionId ? true : false,
    fleetSpeed,
    rampFactor,
    descendStep,
    maxConcurrentDivers,
    maxConcurrentShots,
    attackTickMs,
    diveChancePerTick,
    divePattern,
    turnRate,
    fireTickMs,
    fireChancePerTick,
    updatedAt: now,
  };

  try {
    await ddbDocClient.send(
      new PutCommand({
        TableName: LEVEL_TABLE,
        Item: {
          ...item,
          ...levelKey(gameId, levelId),
        },
      }),
    );
  } catch (err) {
    if (!isMissingTableError(err)) {
      throw err;
    }
    await ddbDocClient.send(
      new PutCommand({
        TableName: GAME_ASSETS_TABLE,
        Item: {
          ...fallbackLevelKey(gameId, levelId),
          entityType: 'levelConfig',
          gameId,
          levelId,
          levelConfig: item,
          updatedAt: now,
        },
      }),
    );
  }

  // Update usage tracking
  const refId = `GAME#${gameId}#LEVEL#${levelId}`;
  if (
    existing?.backgroundAssetId &&
    existing.backgroundAssetId !== backgroundAssetId
  ) {
    await removeUsage(existing.backgroundAssetId, refId);
  }
  if (backgroundAssetId) {
    await upsertUsage(backgroundAssetId, refId, 'level-background');
  }

  return item;
}
