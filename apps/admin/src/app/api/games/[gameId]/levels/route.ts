import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import {
  getLevelConfig,
  listLevelConfigs,
  saveLevelConfig,
} from '../../../../../../lib/levelConfig';

export const runtime = 'nodejs';

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  let session;
  try {
    session = await auth();
  } catch (err) {
    console.error('auth_error_levels_list_get', err);
    return bad('auth_failed', 500);
  }
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin) {
    return bad('unauthorized', 401);
  }

  const { gameId } = await params;
  try {
    const levels = await listLevelConfigs(gameId);
    return NextResponse.json({
      levels: levels.map((level) => ({
        levelId: level.levelId,
        updatedAt: level.updatedAt ?? '',
      })),
    });
  } catch (err) {
    console.error('levels_list_get_error', err);
    return bad('fetch_failed', 500);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  let session;
  try {
    session = await auth();
  } catch (err) {
    console.error('auth_error_levels_create_post', err);
    return bad('auth_failed', 500);
  }
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin) {
    return bad('unauthorized', 401);
  }

  const { gameId } = await params;
  const body = (await req.json().catch(() => ({}))) as { levelId?: string };
  const levelId = (body.levelId ?? '').trim();
  if (!levelId) return bad('level_id_required', 400);

  try {
    const existing = await getLevelConfig(gameId, levelId);
    if (existing) return bad('level_already_exists', 409);

    const created = await saveLevelConfig({
      gameId,
      levelId,
      waves: [],
      formationGrid: {
        columns: 10,
        rows: 5,
        placements: [],
      },
      fleetSpeed: 0,
      rampFactor: 0,
      descendStep: 0,
      maxConcurrentDivers: 0,
      maxConcurrentShots: 0,
      attackTickMs: 1000,
      diveChancePerTick: 0,
      divePattern: 'straight',
      turnRate: 0,
      fireTickMs: 1000,
      fireChancePerTick: 0,
    });

    return NextResponse.json({
      level: {
        levelId: created.levelId,
        updatedAt: created.updatedAt ?? '',
      },
    });
  } catch (err) {
    console.error('levels_create_post_error', err);
    return bad('create_failed', 500);
  }
}
