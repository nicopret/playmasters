import { NextResponse } from 'next/server';
import { auth } from '../../../../../../../auth';
import { archiveVersion } from '../../../../../../../../lib/imageAssets';
import { logAudit } from '../../../../../../../../lib/audit';

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });
export const runtime = 'nodejs';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const session = await auth();
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin)
    return bad('unauthorized', 401);

  const { id, versionId } = await params;
  try {
    const version = await archiveVersion(id, versionId);
    await logAudit({
      entityType: 'ImageAssetVersion',
      entityId: version.versionId,
      action: 'ARCHIVE_VERSION',
      actorUserId: session?.user?.id,
      actorEmail: session?.user?.email ?? undefined,
      details: { assetId: id },
    });
    return NextResponse.json({ version });
  } catch (err) {
    const code = (err as Error).message;
    if (code === 'asset_not_found' || code === 'version_not_found') return bad('not_found', 404);
    if (code === 'cannot_archive_current_draft' || code === 'cannot_archive_current_published')
      return bad('cannot_archive_current', 400);
    if (code === 'version_in_use') return bad('version_in_use', 400);
    console.error('version_archive_error', err);
    return bad('archive_failed', 500);
  }
}
