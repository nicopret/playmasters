import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import {
  type CoreAssetDefinition,
  type CoreAssetDraft,
  getCoreAssetsDraft,
  saveCoreAssetsDraft,
  SPACE_BLASTER_CORE_ASSET_SPECS,
  validateCoreAssetsDraft,
} from '../../../../../lib/coreAssets';

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
    console.error('core_assets_auth_get', err);
    return bad('auth_failed', 500);
  }
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin) {
    return bad('unauthorized', 401);
  }

  const { gameId } = await params;
  try {
    const draft = await getCoreAssetsDraft(gameId);
    return NextResponse.json({
      draft,
      specs: SPACE_BLASTER_CORE_ASSET_SPECS,
    });
  } catch (err) {
    console.error('core_assets_get_failed', err);
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
    console.error('core_assets_auth_post', err);
    return bad('auth_failed', 500);
  }
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin) {
    return bad('unauthorized', 401);
  }

  const { gameId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    defaultTextureKey?: string;
    definitions?: CoreAssetDefinition[];
  };

  const draft: CoreAssetDraft = {
    gameId,
    schemaVersion: 'core-assets.v1',
    defaultTextureKey:
      typeof body.defaultTextureKey === 'string' &&
      body.defaultTextureKey.trim()
        ? body.defaultTextureKey.trim()
        : 'default.space.background',
    definitions: Array.isArray(body.definitions) ? body.definitions : [],
    updatedAt: new Date().toISOString(),
  };

  const issues = validateCoreAssetsDraft(draft);
  if (issues.length > 0) {
    return NextResponse.json(
      { error: 'validation_failed', issues },
      { status: 400 },
    );
  }

  try {
    const saved = await saveCoreAssetsDraft(draft);
    return NextResponse.json({
      draft: saved,
      specs: SPACE_BLASTER_CORE_ASSET_SPECS,
    });
  } catch (err) {
    console.error('core_assets_save_failed', err);
    return bad('save_failed', 500);
  }
}
