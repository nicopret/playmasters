import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient } from './ddb';
import { LevelConfig } from '@playmasters/types';
import { getAsset, getVersion } from './imageAssets';
import { removeUsage, upsertUsage } from './assetUsage';

const LEVEL_TABLE =
  process.env.DDB_TABLE_LEVEL_CONFIG ?? 'PlaymastersLevelConfig';
const LEVEL_PK_ATTR =
  process.env.DDB_PK_NAME_LEVEL_CONFIG || process.env.DDB_PK_NAME || 'PK';
const LEVEL_SK_ATTR =
  process.env.DDB_SK_NAME_LEVEL_CONFIG || process.env.DDB_SK_NAME || 'SK';

const levelKey = (gameId: string, levelId: string) => ({
  [LEVEL_PK_ATTR]: `GAME#${gameId}`,
  [LEVEL_SK_ATTR]: `LEVEL#${levelId}`,
});

export async function getLevelConfig(
  gameId: string,
  levelId: string,
): Promise<LevelConfig | null> {
  const res = await ddbDocClient.send(
    new GetCommand({
      TableName: LEVEL_TABLE,
      Key: levelKey(gameId, levelId),
    }),
  );
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

export async function saveLevelConfig(input: {
  gameId: string;
  levelId: string;
  layoutId?: string;
  backgroundAssetId?: string;
  backgroundVersionId?: string;
  pinToVersion?: boolean;
  waves?: LevelConfig['waves'];
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
    const asset = await getAsset(backgroundAssetId);
    if (!asset) throw new Error('background_not_found');
    if (asset.type !== 'background') throw new Error('not_a_background');
    if (backgroundVersionId) {
      const v = await getVersion(backgroundAssetId, backgroundVersionId);
      if (!v || v.state !== 'Published')
        throw new Error('background_version_not_published');
    }
  }

  const item: LevelConfig = {
    gameId,
    levelId,
    layoutId,
    waves: waves ?? [],
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

  await ddbDocClient.send(
    new PutCommand({
      TableName: LEVEL_TABLE,
      Item: {
        ...item,
        ...levelKey(gameId, levelId),
      },
    }),
  );

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
