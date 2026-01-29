import { NextResponse } from 'next/server';
import { auth } from '../../../auth';
import { createSessionToken } from '../../../lib/gameSessions';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { gameId?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (!body.gameId) {
    return NextResponse.json({ error: 'missing_game' }, { status: 400 });
  }

  const { token, expiresAt } = createSessionToken(session.user.id, body.gameId);
  return NextResponse.json({ token, expiresAt: new Date(expiresAt).toISOString() });
}
