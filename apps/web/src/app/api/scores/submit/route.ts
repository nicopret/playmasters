import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { consumeSessionToken, validateSessionToken } from '../../../../lib/gameSessions';
import { getGameById } from '../../../../lib/games';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const userHits = new Map<string, number[]>();

const isRateLimited = (userId: string) => {
  const now = Date.now();
  const hits = (userHits.get(userId) ?? []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  if (hits.length >= RATE_LIMIT_MAX) {
    userHits.set(userId, hits);
    return true;
  }
  hits.push(now);
  userHits.set(userId, hits);
  return false;
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: {
    gameId?: string;
    score?: number;
    runId?: string;
    sessionToken?: string;
    durationMs?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { gameId, score, runId, sessionToken } = body;
  if (!gameId || !runId || !sessionToken || typeof score !== 'number') {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  if (!Number.isInteger(score) || score < 0) {
    return NextResponse.json({ error: 'invalid_score' }, { status: 400 });
  }

  if (isRateLimited(session.user.id)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const game = getGameById(gameId);
  if (!game) {
    return NextResponse.json({ error: 'unknown_game' }, { status: 404 });
  }

  if (game.maxScore && score > game.maxScore) {
    return NextResponse.json({ error: 'score_too_high' }, { status: 400 });
  }

  const tokenCheck = validateSessionToken(sessionToken, session.user.id, gameId);
  if (!tokenCheck.ok) {
    return NextResponse.json({ error: tokenCheck.error }, { status: 400 });
  }

  const realtimeUrl = process.env.REALTIME_HTTP_URL ?? 'http://localhost:4000';
  const ingestSecret = process.env.REALTIME_INGEST_SECRET;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (ingestSecret) headers['x-realtime-secret'] = ingestSecret;

  const countryCode =
    process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE ??
    process.env.DEFAULT_COUNTRY_CODE ??
    'GB';

  try {
    const resp = await fetch(`${realtimeUrl}/score`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        gameId,
        userId: session.user.id,
        displayName: session.user.name ?? session.user.email ?? 'Player',
        countryCode,
        score,
        achievedAt: new Date().toISOString(),
      }),
    });

    if (!resp.ok) {
      throw new Error('realtime_error');
    }
  } catch (err) {
    console.warn('Failed to submit score to realtime', err);
    return NextResponse.json({ ok: false, error: 'realtime_unavailable' }, { status: 503 });
  }

  consumeSessionToken(sessionToken);
  return NextResponse.json({ ok: true });
}
