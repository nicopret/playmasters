import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient } from '../../lib/ddb';

export type BaseEnemyScore = { enemyId: string; score: number };

export type LevelScoreMultiplier = {
  base: number;
  perLevel: number;
  max: number;
};

export type ComboTier = {
  minCount: number;
  multiplier: number;
  tierBonus?: number;
  name?: string;
};

export type ComboConfig = {
  enabled: boolean;
  tiers: ComboTier[];
  minWindowMs?: number;
  windowMs?: number;
  resetOnPlayerHit?: boolean;
  windowDecayPerLevelMs?: number;
};

export type ScoreConfigDraft = {
  scoreConfigId: string;
  baseEnemyScores: BaseEnemyScore[];
  levelScoreMultiplier?: LevelScoreMultiplier;
  combo?: ComboConfig;
  updatedAt: string;
};

const SCORE_TABLE =
  process.env.DDB_TABLE_SCORE_CONFIG ?? 'PlaymastersScoreConfig';
const PK_ATTR =
  process.env.DDB_PK_NAME_SCORE_CONFIG || process.env.DDB_PK_NAME || 'PK';
const SK_ATTR =
  process.env.DDB_SK_NAME_SCORE_CONFIG || process.env.DDB_SK_NAME || 'SK';

const scoreKey = (id: string) => ({
  [PK_ATTR]: `SCORECONFIG#${id}`,
  [SK_ATTR]: `SCORECONFIG#${id}`,
});

export async function getScoreConfigDraft(
  id = 'default',
): Promise<ScoreConfigDraft | null> {
  const res = await ddbDocClient.send(
    new GetCommand({
      TableName: SCORE_TABLE,
      Key: scoreKey(id),
    }),
  );
  if (!res.Item) return null;
  const { [PK_ATTR]: _pk, [SK_ATTR]: _sk, ...rest } = res.Item;
  void _pk;
  void _sk;
  const cfg = rest as ScoreConfigDraft;
  cfg.baseEnemyScores = Array.isArray(cfg.baseEnemyScores)
    ? cfg.baseEnemyScores
    : [];
  cfg.levelScoreMultiplier = cfg.levelScoreMultiplier ?? {
    base: 1,
    perLevel: 0,
    max: 1,
  };
  cfg.combo = cfg.combo ?? {
    enabled: false,
    tiers: [],
  };
  return cfg;
}

export async function saveScoreConfigDraft(input: {
  id?: string;
  baseEnemyScores: BaseEnemyScore[];
  levelScoreMultiplier?: Partial<LevelScoreMultiplier>;
  combo?: Partial<ComboConfig>;
}): Promise<ScoreConfigDraft> {
  const id = input.id ?? 'default';
  const now = new Date().toISOString();
  const levelScoreMultiplier: LevelScoreMultiplier = {
    base: input.levelScoreMultiplier?.base ?? 1,
    perLevel: input.levelScoreMultiplier?.perLevel ?? 0,
    max: input.levelScoreMultiplier?.max ?? 1,
  };
  const combo: ComboConfig = {
    enabled: input.combo?.enabled ?? false,
    tiers: Array.isArray(input.combo?.tiers) ? input.combo?.tiers : [],
    minWindowMs: input.combo?.minWindowMs,
    windowMs: input.combo?.windowMs,
    resetOnPlayerHit: input.combo?.resetOnPlayerHit,
    windowDecayPerLevelMs: input.combo?.windowDecayPerLevelMs,
  };
  const draft: ScoreConfigDraft = {
    scoreConfigId: id,
    baseEnemyScores: input.baseEnemyScores ?? [],
    levelScoreMultiplier,
    combo,
    updatedAt: now,
  };

  await ddbDocClient.send(
    new PutCommand({
      TableName: SCORE_TABLE,
      Item: {
        ...scoreKey(id),
        ...draft,
      },
    }),
  );

  return draft;
}
