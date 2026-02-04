import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { listAudit } from '../../../../../../lib/audit';

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
    const entries = await listAudit(id, 10);
    return NextResponse.json({ entries });
  } catch (err) {
    console.error('audit_fetch_error', err);
    return bad('fetch_failed', 500);
  }
}
