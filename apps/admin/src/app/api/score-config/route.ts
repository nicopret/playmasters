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
    });
    return NextResponse.json({ config: saved });
  } catch (err) {
    console.error('score_config_save_error', err);
    return bad('save_failed', 500);
  }
}
