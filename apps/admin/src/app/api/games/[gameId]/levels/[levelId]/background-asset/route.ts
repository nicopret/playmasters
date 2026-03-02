import { NextResponse } from 'next/server';
import { auth } from '../../../../../../../auth';
import {
  type CoreAssetDefinition,
  getCoreAssetDefinition,
  getCoreAssetsDraft,
  saveCoreAssetDefinition,
} from '../../../../../../../lib/coreAssets';

export const runtime = 'nodejs';

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

const createDefaultLevelBackgroundDefinition = (
  levelId: string,
): CoreAssetDefinition => ({
  id: `${levelId}.background`,
  displayName: `Level ${levelId} Background`,
  kind: 'vfx',
  slots: [{ slotId: 'image.main', label: 'Background Image', media: 'image' }],
  variables: {},
  fx: {},
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gameId: string; levelId: string }> },
) {
  let session;
  try {
    session = await auth();
  } catch (err) {
    console.error('level_background_asset_auth_get', err);
    return bad('auth_failed', 500);
  }
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin) {
    return bad('unauthorized', 401);
  }

  const { gameId, levelId } = await params;
  const definitionId = `${levelId}.background`;

  try {
    const existing = await getCoreAssetDefinition({ gameId, definitionId });
    return NextResponse.json({
      definition: existing ?? createDefaultLevelBackgroundDefinition(levelId),
    });
  } catch (err) {
    console.error('level_background_asset_get_failed', err);
    return bad('fetch_failed', 500);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ gameId: string; levelId: string }> },
) {
  let session;
  try {
    session = await auth();
  } catch (err) {
    console.error('level_background_asset_auth_post', err);
    return bad('auth_failed', 500);
  }
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin) {
    return bad('unauthorized', 401);
  }

  const { gameId, levelId } = await params;
  const expectedId = `${levelId}.background`;
  const body = (await req.json().catch(() => ({}))) as {
    definition?: CoreAssetDefinition;
  };
  const definition = body.definition;

  if (!definition) {
    return bad('definition_required');
  }
  if (definition.id !== expectedId) {
    return bad('invalid_definition_id');
  }
  if (!Array.isArray(definition.slots) || definition.slots.length === 0) {
    return bad('slots_required');
  }

  try {
    const draft = await getCoreAssetsDraft(gameId);
    await saveCoreAssetDefinition({
      gameId,
      defaultTextureKey: draft.defaultTextureKey,
      definition,
    });
    return NextResponse.json({ definition });
  } catch (err) {
    console.error('level_background_asset_save_failed', err);
    return bad('save_failed', 500);
  }
}
