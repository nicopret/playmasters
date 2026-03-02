import { NextResponse } from 'next/server';
import { auth } from '../../../../../../auth';
import {
  type CoreAssetFileRef,
  type CoreAssetDraft,
  getCoreAssetSpecMap,
  getCoreAssetsDraft,
  saveCoreAssetDefinition,
  validateCoreAssetsDraft,
} from '../../../../../../lib/coreAssets';

export const runtime = 'nodejs';

const bad = (message: string, status = 400, details?: string | undefined) =>
  NextResponse.json(
    details ? { error: message, details } : { error: message },
    { status },
  );

type SfxPresetPatchInput = {
  definitionId: string;
  presetJson: string;
  slotId?: string;
  uploadedFile?: CoreAssetFileRef;
};

export function patchSfxPresetInDraft(
  draft: CoreAssetDraft,
  input: SfxPresetPatchInput,
): CoreAssetDraft {
  const specById = getCoreAssetSpecMap();
  const spec = specById.get(input.definitionId);
  if (!spec) {
    throw new Error('definition_not_found');
  }
  if (spec.kind !== 'sfx') {
    throw new Error('definition_not_sfx');
  }
  if (input.uploadedFile && !input.slotId) {
    throw new Error('slot_id_required');
  }
  if (input.slotId) {
    const slotSpec = spec.slots.find((slot) => slot.slotId === input.slotId);
    if (!slotSpec) {
      throw new Error('slot_not_found');
    }
    if (slotSpec.media !== 'audio') {
      throw new Error('slot_not_audio');
    }
  }

  const updatedDefinitions = draft.definitions.map((definition) => {
    if (definition.id !== input.definitionId) return definition;
    return {
      ...definition,
      slots: input.slotId
        ? definition.slots.map((slot) =>
            slot.slotId === input.slotId && input.uploadedFile
              ? { ...slot, file: input.uploadedFile }
              : slot,
          )
        : definition.slots,
      variables: {
        ...definition.variables,
        presetJson: input.presetJson,
      },
    };
  });

  if (
    !updatedDefinitions.some(
      (definition) => definition.id === input.definitionId,
    )
  ) {
    throw new Error('definition_not_found');
  }

  return {
    ...draft,
    definitions: updatedDefinitions,
  };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  let session;
  try {
    session = await auth();
  } catch (err) {
    console.error('core_assets_sfx_preset_auth', err);
    return bad('auth_failed', 500);
  }
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin) {
    return bad('unauthorized', 401);
  }

  const { gameId } = await params;
  const body = (await req
    .json()
    .catch(() => ({}))) as Partial<SfxPresetPatchInput>;
  const definitionId =
    typeof body.definitionId === 'string' ? body.definitionId.trim() : '';
  const presetJson =
    typeof body.presetJson === 'string' ? body.presetJson.trim() : '';
  const slotId = typeof body.slotId === 'string' ? body.slotId.trim() : '';
  const uploadedFile = body.uploadedFile as CoreAssetFileRef | undefined;
  if (!definitionId) return bad('definition_id_required');
  if (!presetJson) return bad('preset_json_required');

  try {
    JSON.parse(presetJson);
  } catch {
    return bad('invalid_json_preset');
  }
  if (uploadedFile) {
    if (
      typeof uploadedFile.fileName !== 'string' ||
      typeof uploadedFile.contentType !== 'string' ||
      typeof uploadedFile.uploadedAt !== 'string' ||
      (!uploadedFile.objectKey && !uploadedFile.inlineDataUrl)
    ) {
      return bad('uploaded_file_invalid');
    }
    if (!slotId) return bad('slot_id_required');
  }

  try {
    const draft = await getCoreAssetsDraft(gameId);
    const patched = patchSfxPresetInDraft(draft, {
      definitionId,
      presetJson,
      slotId: slotId || undefined,
      uploadedFile,
    });
    const issues = validateCoreAssetsDraft(patched);
    if (issues.length > 0) {
      return NextResponse.json(
        { error: 'validation_failed', issues },
        { status: 400 },
      );
    }
    const target = patched.definitions.find(
      (definition) => definition.id === definitionId,
    );
    if (!target) {
      return bad('definition_not_found', 404);
    }
    await saveCoreAssetDefinition({
      gameId,
      defaultTextureKey: patched.defaultTextureKey,
      definition: target,
    });
    return NextResponse.json({ definitionId });
  } catch (err) {
    if (err instanceof Error && err.message === 'definition_not_found') {
      return bad('definition_not_found', 404);
    }
    if (err instanceof Error && err.message === 'definition_not_sfx') {
      return bad('definition_not_sfx', 400);
    }
    if (err instanceof Error && err.message === 'slot_id_required') {
      return bad('slot_id_required', 400);
    }
    if (err instanceof Error && err.message === 'slot_not_found') {
      return bad('slot_not_found', 404);
    }
    if (err instanceof Error && err.message === 'slot_not_audio') {
      return bad('slot_not_audio', 400);
    }
    console.error('core_assets_sfx_preset_failed', err);
    return bad(
      'save_failed',
      500,
      process.env.NODE_ENV === 'development' && err instanceof Error
        ? err.message
        : undefined,
    );
  }
}
