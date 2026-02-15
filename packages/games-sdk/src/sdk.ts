import type { GameContext, GameSdk, GameRun } from './types';

const safeJson = async (res: Response) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

export function createGameSdk(ctx: GameContext): GameSdk {
  let sessionToken: string | null = null;
  let run: GameRun | null = null;
  const apiBaseUrl = ctx.apiBaseUrl ?? '';

  const startRun = async () => {
    const response = await fetch(`${apiBaseUrl}/api/game-sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameId: ctx.gameId }),
    });

    const json = await safeJson(response);
    if (!response.ok || !json?.token) {
      throw new Error(
        (json as { error?: string } | null)?.error ?? 'session_failed',
      );
    }

    sessionToken = json.token as string;
    run = { runId: crypto.randomUUID(), startedAt: new Date().toISOString() };

    return { run, sessionToken };
  };

  const submitScore: GameSdk['submitScore'] = async ({
    score,
    durationMs,
    configHash,
    versionHash,
  }) => {
    if (!run || !sessionToken) {
      throw new Error('run_not_started');
    }

    const response = await fetch(`${apiBaseUrl}/api/scores/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        gameId: ctx.gameId,
        score,
        durationMs,
        configHash,
        versionHash,
        runId: run.runId,
        sessionToken,
      }),
    });

    const json = await safeJson(response);
    if (
      !response.ok ||
      (json as { ok?: boolean; error?: string } | null)?.ok === false
    ) {
      throw new Error(
        (json as { error?: string } | null)?.error ?? 'submit_failed',
      );
    }
  };

  return { isAuthenticated: Boolean(ctx.user), startRun, submitScore };
}
