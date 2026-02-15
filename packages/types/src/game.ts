export type EmbeddedGameSdk = {
  isAuthenticated?: boolean;
  startRun(): Promise<{
    run: { runId: string; startedAt: string };
    sessionToken: string;
  }>;
  submitScore(payload: {
    runId?: string;
    score: number;
    durationMs: number;
    levelReached: number;
    waveReached: number;
    stats: {
      shotsFired: number;
      shotsHit: number;
      kills: number;
      wavesCleared: number;
    };
    configHash: string;
    versionHash?: string;
  }): Promise<void>;
};

export type EmbeddedGame = {
  mount: (opts: {
    el: HTMLElement;
    sdk: EmbeddedGameSdk;
    resolvedConfig?: unknown;
    onReady?: () => void;
    onGameOver?: (finalScore: number) => void;
  }) => { destroy: () => void };
};
