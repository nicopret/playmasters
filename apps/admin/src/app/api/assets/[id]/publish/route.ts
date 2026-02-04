import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { publishDraft } from '../../../../../../lib/imageAssets';
import { logAudit } from '../../../../../../lib/audit';

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });
export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log(await params)
  const session = await auth();
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin)
    return bad('unauthorized', 401);

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { versionId?: string; changeNotes?: string };
  console.log({ body, id })

  const versionId = body.versionId?.trim();
  const changeNotes = body.changeNotes?.trim();
  if (!versionId) return bad('versionId_required');
  if (!changeNotes) return bad('changeNotes_required');

  try {
    const { asset, version } = await publishDraft({
      assetId: id,
      versionId,
      changeNotes,
    });
    await logAudit({
      entityType: 'ImageAssetVersion',
      entityId: version.versionId,
      action: 'PUBLISH_VERSION',
      actorUserId: session?.user?.id,
      actorEmail: session?.user?.email ?? undefined,
      details: {
        assetId: id,
        versionId: version.versionId,
        changeNotes,
        previousPublishedVersionId: asset.currentPublishedVersionId,
      },
    });
    return NextResponse.json({ asset, version });
  } catch (err) {
    const code = (err as Error).message;
    if (code === 'asset_not_found' || code === 'version_not_found') return bad('not_found', 404);
    if (code === 'no_draft' || code === 'version_not_current_draft' || code === 'version_not_draft')
      return bad('invalid_draft', 400);
    if (code === 'invalid_asset_type') return bad('invalid_asset_type', 400);
    if (code === 'background_too_large') return bad('background_too_large', 400);
    if (code === 'background_invalid_format') return bad('background_invalid_format', 400);
    if (code === 'sprite_requires_png') return bad('sprite_requires_png', 400);
    if (code === 'storage_not_configured') return bad('storage_not_configured', 500);
    console.error('publish_error', err);
    return bad('publish_failed', 500);
  }
}
