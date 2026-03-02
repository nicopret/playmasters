import { NextResponse } from 'next/server';
import { auth } from '../../../../../../auth';
import {
  type CoreAssetDefinition,
  getCoreAssetsDraft,
  saveCoreAssetDefinition,
  validateCoreAssetsDraft,
} from '../../../../../../lib/coreAssets';

export const runtime = 'nodejs';

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  let session;
  try {
    session = await auth();
  } catch (err) {
    console.error('core_asset_definition_auth', err);
    return bad('auth_failed', 500);
  }
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin) {
    return bad('unauthorized', 401);
  }

  const { gameId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    definition?: CoreAssetDefinition;
  };
  const definition = body.definition;

  if (!definition || typeof definition.id !== 'string') {
    return bad('definition_required');
  }

  try {
    const draft = await getCoreAssetsDraft(gameId);
    const existing = draft.definitions.find(
      (item) => item.id === definition.id,
    );
    if (!existing) {
      return bad('definition_not_found', 404);
    }

    const patched = {
      ...draft,
      definitions: draft.definitions.map((item) =>
        item.id === definition.id ? definition : item,
      ),
    };
    const issues = validateCoreAssetsDraft(patched);
    if (issues.length > 0) {
      return NextResponse.json(
        { error: 'validation_failed', issues },
        { status: 400 },
      );
    }

    const savedDefinition = await saveCoreAssetDefinition({
      gameId,
      defaultTextureKey: patched.defaultTextureKey,
      definition,
    });

    return NextResponse.json({
      definition: savedDefinition,
      definitionId: savedDefinition.id,
    });
  } catch (err) {
    console.error('core_asset_definition_save_failed', err);
    return bad('save_failed', 500);
  }
}
