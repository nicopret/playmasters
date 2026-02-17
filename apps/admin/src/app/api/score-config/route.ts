import { NextResponse } from 'next/server';
import { auth } from '../../../auth';
import {
  getScoreConfigDraft,
  saveScoreConfigDraft,
  BaseEnemyScore,
  type ScoreConfigDraft,
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
    accuracyBonus?: {
      scaleByLevelMultiplier?: boolean;
      thresholds?: {
        minAccuracy?: number;
        bonus?: number;
      }[];
    };
  };

  const scores = Array.isArray(body.baseEnemyScores)
    ? body.baseEnemyScores
    : [];

  try {
    const existing: ScoreConfigDraft = (await getScoreConfigDraft()) ?? {
      scoreConfigId: 'default',
      baseEnemyScores: [],
      levelScoreMultiplier: { base: 1, perLevel: 0, max: 1 },
      combo: { enabled: false, tiers: [] },
      waveClearBonus: { base: 0, perLifeBonus: 0 },
      accuracyBonus: { scaleByLevelMultiplier: false, thresholds: [] },
      updatedAt: '',
    };

    const saved = await saveScoreConfigDraft({
      baseEnemyScores: scores.map((s) => ({
        enemyId: s.enemyId?.trim?.() ?? '',
        score: typeof s.score === 'number' ? s.score : 0,
      })),
      levelScoreMultiplier: {
        base:
          typeof body.levelScoreMultiplier?.base === 'number'
            ? body.levelScoreMultiplier.base
            : existing.levelScoreMultiplier?.base,
        perLevel:
          typeof body.levelScoreMultiplier?.perLevel === 'number'
            ? body.levelScoreMultiplier.perLevel
            : existing.levelScoreMultiplier?.perLevel,
        max:
          typeof body.levelScoreMultiplier?.max === 'number'
            ? body.levelScoreMultiplier.max
            : existing.levelScoreMultiplier?.max,
      },
      combo: {
        enabled:
          typeof body.combo?.enabled === 'boolean'
            ? body.combo.enabled
            : existing.combo?.enabled,
        tiers: Array.isArray(body.combo?.tiers)
          ? body.combo?.tiers.map((t) => ({
              minCount: typeof t.minCount === 'number' ? t.minCount : 1,
              multiplier: typeof t.multiplier === 'number' ? t.multiplier : 1,
              tierBonus: typeof t.tierBonus === 'number' ? t.tierBonus : 0,
              name: t.name,
            }))
          : existing.combo?.tiers,
        minWindowMs:
          typeof body.combo?.minWindowMs === 'number'
            ? body.combo?.minWindowMs
            : existing.combo?.minWindowMs,
        windowMs:
          typeof body.combo?.windowMs === 'number'
            ? body.combo?.windowMs
            : existing.combo?.windowMs,
        resetOnPlayerHit:
          typeof body.combo?.resetOnPlayerHit === 'boolean'
            ? body.combo?.resetOnPlayerHit
            : existing.combo?.resetOnPlayerHit,
        windowDecayPerLevelMs:
          typeof body.combo?.windowDecayPerLevelMs === 'number'
            ? body.combo?.windowDecayPerLevelMs
            : existing.combo?.windowDecayPerLevelMs,
      },
      waveClearBonus: {
        base:
          typeof body.waveClearBonus?.base === 'number'
            ? body.waveClearBonus.base
            : existing.waveClearBonus?.base,
        perLifeBonus:
          typeof body.waveClearBonus?.perLifeBonus === 'number'
            ? body.waveClearBonus.perLifeBonus
            : existing.waveClearBonus?.perLifeBonus,
      },
      accuracyBonus: {
        scaleByLevelMultiplier:
          typeof body.accuracyBonus?.scaleByLevelMultiplier === 'boolean'
            ? body.accuracyBonus.scaleByLevelMultiplier
            : existing.accuracyBonus?.scaleByLevelMultiplier,
        thresholds: Array.isArray(body.accuracyBonus?.thresholds)
          ? body.accuracyBonus.thresholds.map((t) => ({
              minAccuracy:
                typeof t.minAccuracy === 'number' ? t.minAccuracy : 0,
              bonus: typeof t.bonus === 'number' ? t.bonus : 0,
            }))
          : existing.accuracyBonus?.thresholds,
      },
    });
    return NextResponse.json({ config: saved });
  } catch (err) {
    console.error('score_config_save_error', err);
    return bad('save_failed', 500);
  }
}
