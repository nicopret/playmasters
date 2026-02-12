import { NextResponse } from 'next/server';
import { auth } from '../../../auth';
import {
  getScoreConfigDraft,
  saveScoreConfigDraft,
  BaseEnemyScore,
} from '../../../lib/scoreConfig';

export const runtime = 'nodejs';

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function GET() {
  let session;
  try {
    session = await auth();
  } catch (err) {
    console.error('score_config_auth_get', err);
    return bad('auth_failed', 500);
  }
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin)
    return bad('unauthorized', 401);

  const cfg = (await getScoreConfigDraft()) ?? {
    scoreConfigId: 'default',
    baseEnemyScores: [],
    updatedAt: '',
  };
  return NextResponse.json({ config: cfg });
}

export async function POST(req: Request) {
  let session;
  try {
    session = await auth();
  } catch (err) {
    console.error('score_config_auth_post', err);
    return bad('auth_failed', 500);
  }
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin)
    return bad('unauthorized', 401);

  const body = (await req.json().catch(() => ({}))) as {
    baseEnemyScores?: BaseEnemyScore[];
    levelScoreMultiplier?: {
      base?: number;
      perLevel?: number;
      max?: number;
    };
    combo?: {
      enabled?: boolean;
      tiers?: {
        minCount?: number;
        multiplier?: number;
        tierBonus?: number;
        name?: string;
      }[];
      minWindowMs?: number;
      windowMs?: number;
      resetOnPlayerHit?: boolean;
      windowDecayPerLevelMs?: number;
    };
    waveClearBonus?: {
      base?: number;
      perLifeBonus?: number;
    };
  };

  const scores = Array.isArray(body.baseEnemyScores)
    ? body.baseEnemyScores
    : [];

  try {
    const saved = await saveScoreConfigDraft({
      baseEnemyScores: scores.map((s) => ({
        enemyId: s.enemyId?.trim?.() ?? '',
        score: typeof s.score === 'number' ? s.score : 0,
      })),
      levelScoreMultiplier: {
        base:
          typeof body.levelScoreMultiplier?.base === 'number'
            ? body.levelScoreMultiplier.base
            : undefined,
        perLevel:
          typeof body.levelScoreMultiplier?.perLevel === 'number'
            ? body.levelScoreMultiplier.perLevel
            : undefined,
        max:
          typeof body.levelScoreMultiplier?.max === 'number'
            ? body.levelScoreMultiplier.max
            : undefined,
      },
      combo: {
        enabled: !!body.combo?.enabled,
        tiers: Array.isArray(body.combo?.tiers)
          ? body.combo?.tiers.map((t) => ({
              minCount: typeof t.minCount === 'number' ? t.minCount : 1,
              multiplier: typeof t.multiplier === 'number' ? t.multiplier : 1,
              tierBonus: typeof t.tierBonus === 'number' ? t.tierBonus : 0,
              name: t.name,
            }))
          : [],
        minWindowMs:
          typeof body.combo?.minWindowMs === 'number'
            ? body.combo?.minWindowMs
            : undefined,
        windowMs:
          typeof body.combo?.windowMs === 'number'
            ? body.combo?.windowMs
            : undefined,
        resetOnPlayerHit:
          typeof body.combo?.resetOnPlayerHit === 'boolean'
            ? body.combo?.resetOnPlayerHit
            : undefined,
        windowDecayPerLevelMs:
          typeof body.combo?.windowDecayPerLevelMs === 'number'
            ? body.combo?.windowDecayPerLevelMs
            : undefined,
      },
      waveClearBonus: {
        base:
          typeof body.waveClearBonus?.base === 'number'
            ? body.waveClearBonus.base
            : undefined,
        perLifeBonus:
          typeof body.waveClearBonus?.perLifeBonus === 'number'
            ? body.waveClearBonus.perLifeBonus
            : undefined,
      },
    });
    return NextResponse.json({ config: saved });
  } catch (err) {
    console.error('score_config_save_error', err);
    return bad('save_failed', 500);
  }
}
