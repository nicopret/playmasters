import { randomUUID } from 'crypto';

type SessionRecord = {
  token: string;
  userId: string;
  gameId: string;
  expiresAt: number;
  consumed: boolean;
};

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const sessions = new Map<string, SessionRecord>();

const now = () => Date.now();

function pruneExpired() {
  const current = now();
  for (const [token, record] of sessions.entries()) {
    if (record.expiresAt <= current) {
      sessions.delete(token);
    }
  }
}

export function createSessionToken(userId: string, gameId: string) {
  pruneExpired();
  const token = randomUUID();
  const expiresAt = now() + TTL_MS;

  sessions.set(token, {
    token,
    userId,
    gameId,
    expiresAt,
    consumed: false,
  });

  return { token, expiresAt };
}

export function validateSessionToken(token: string, userId: string, gameId: string) {
  pruneExpired();
  const session = sessions.get(token);
  if (!session) return { ok: false, error: 'invalid_token' as const };
  if (session.consumed) return { ok: false, error: 'token_consumed' as const };
  if (session.userId !== userId || session.gameId !== gameId) {
    return { ok: false, error: 'token_mismatch' as const };
  }
  if (session.expiresAt < now()) return { ok: false, error: 'token_expired' as const };
  return { ok: true, session };
}

export function consumeSessionToken(token: string) {
  const session = sessions.get(token);
  if (!session) return false;
  session.consumed = true;
  sessions.set(token, session);
  return true;
}
