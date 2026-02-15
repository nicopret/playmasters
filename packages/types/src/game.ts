export type EmbeddedGameSdk = {
  isAuthenticated?: boolean;
  startRun(): Promise<{
    run: { runId: string; startedAt: string };
    sessionToken: string;
  }>;
  submitScore(payload: {
    score: number;
    durationMs?: number;
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
