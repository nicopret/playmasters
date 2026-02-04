import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { rollbackPublished } from '../../../../../../lib/imageAssets';
import { logAudit } from '../../../../../../lib/audit';

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });
export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin)
    return bad('unauthorized', 401);

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { versionId?: string };
  const versionId = body.versionId?.trim();
  if (!versionId) return bad('versionId_required');

  try {
    const asset = await rollbackPublished({ assetId: id, versionId });
    await logAudit({
      entityType: 'ImageAsset',
      entityId: asset.assetId,
      action: 'ROLLBACK_PUBLISHED',
      actorUserId: session?.user?.id,
      actorEmail: session?.user?.email ?? undefined,
      details: { versionId },
    });
    return NextResponse.json({ asset });
  } catch (err) {
    const code = (err as Error).message;
    if (code === 'asset_not_found' || code === 'version_not_found') return bad('not_found', 404);
    if (code === 'version_not_published') return bad('not_published', 400);
    console.error('rollback_error', err);
    return bad('rollback_failed', 500);
  }
}
