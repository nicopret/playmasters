import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { countAssetUsage, listAssetUsage } from '../../../../../../lib/assetUsage';

export const runtime = 'nodejs';
const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin)
    return bad('unauthorized', 401);

  const { id } = await params;
  try {
    const [count, usage] = await Promise.all([countAssetUsage(id), listAssetUsage(id)]);
    return NextResponse.json({ count, usage });
  } catch (err) {
    console.error('asset_usage_error', err);
    return bad('usage_failed', 500);
  }
}
