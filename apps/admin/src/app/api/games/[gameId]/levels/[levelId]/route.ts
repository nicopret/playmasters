import { NextResponse } from 'next/server';
import { auth } from '../../../../../../auth';
import { getLevelConfig, saveLevelConfig } from '../../../../../../lib/levelConfig';

export const runtime = 'nodejs';
const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gameId: string; levelId: string }> }
) {
  const session = await auth();
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin)
    return bad('unauthorized', 401);
  const { gameId, levelId } = await params;
  try {
    const cfg = await getLevelConfig(gameId, levelId);
    return NextResponse.json({
      config:
        cfg ??
        ({
          gameId,
          levelId,
          updatedAt: '',
        } as const),
    });
  } catch (err) {
    console.error('level_config_get_error', err);
    return bad('fetch_failed', 500);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ gameId: string; levelId: string }> }
) {
  const session = await auth();
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin)
    return bad('unauthorized', 401);
  const { gameId, levelId } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    backgroundAssetId?: string;
    backgroundVersionId?: string;
    pinToVersion?: boolean;
  };

  try {
    const saved = await saveLevelConfig({
      gameId,
      levelId,
      backgroundAssetId: body.backgroundAssetId?.trim() || undefined,
      backgroundVersionId: body.backgroundVersionId?.trim() || undefined,
      pinToVersion: !!body.pinToVersion,
    });
    return NextResponse.json({ config: saved });
  } catch (err) {
    const code = (err as Error).message;
    if (
      code === 'background_not_found' ||
      code === 'not_a_background' ||
      code === 'background_version_not_published'
    ) {
      return bad(code, 400);
    }
    console.error('level_config_save_error', err);
    return bad('save_failed', 500);
  }
}
