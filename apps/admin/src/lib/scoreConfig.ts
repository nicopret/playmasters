import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient } from '../../lib/ddb';

export type BaseEnemyScore = { enemyId: string; score: number };

export type ScoreConfigDraft = {
  scoreConfigId: string;
  baseEnemyScores: BaseEnemyScore[];
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
  return cfg;
}

export async function saveScoreConfigDraft(input: {
  id?: string;
  baseEnemyScores: BaseEnemyScore[];
}): Promise<ScoreConfigDraft> {
  const id = input.id ?? 'default';
  const now = new Date().toISOString();
  const draft: ScoreConfigDraft = {
    scoreConfigId: id,
    baseEnemyScores: input.baseEnemyScores ?? [],
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
