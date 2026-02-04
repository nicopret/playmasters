import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { createDraftFromPublished } from '../../../../../../lib/imageAssets';

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
  const body = (await req.json().catch(() => ({}))) as { changeNotes?: string };
  const changeNotes = typeof body.changeNotes === 'string' ? body.changeNotes : undefined;

  try {
    const { asset, version } = await createDraftFromPublished({
      assetId: id,
      createdBy: session?.user?.id ?? 'anonymous',
      changeNotes,
    });
    return NextResponse.json({ asset, version });
  } catch (err) {
    const code = (err as Error).message;
    if (code === 'asset_not_found') return bad('not_found', 404);
    if (code === 'no_published_version') return bad('no_published_version', 400);
    if (code === 'draft_already_exists') return bad('draft_already_exists', 409);
    if (code === 'published_version_not_found' || code === 'version_not_published')
      return bad('published_version_missing', 400);
    if (code === 'draft_or_published_bucket_missing') return bad('storage_not_configured', 500);
    console.error('draft_from_published_error', err);
    return bad('draft_from_published_failed', 500);
  }
}
