import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { listPublishedBackgroundCatalog } from '../../../../../lib/imageAssets';

export const runtime = 'nodejs';
const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function GET() {
  const session = await auth();
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin)
    return bad('unauthorized', 401);

  try {
    const backgrounds = await listPublishedBackgroundCatalog();
    return NextResponse.json(
      { backgrounds },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (err) {
    console.error('catalog_backgrounds_error', err);
    return bad('catalog_failed', 500);
  }
}
