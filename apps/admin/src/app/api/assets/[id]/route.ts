import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { getAsset } from '../../../../../lib/imageAssets';

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });
export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin)
    return bad('unauthorized', 401);

  const { id } = await params;
  try {
    const asset = await getAsset(id);
    if (!asset) return bad('not_found', 404);

    return NextResponse.json({ asset });
  } catch (err) {
    console.error('asset_fetch_error', err);
    return bad('fetch_failed', 500);
  }
}
