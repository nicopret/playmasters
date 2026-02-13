export type GameSdkContract = {
  startRun(): Promise<{
    run: { runId: string; startedAt: string };
    sessionToken: string;
  }>;
  submitScore(payload: { score: number; durationMs?: number }): Promise<void>;
};

export type EmbeddedGame = {
  mount: (opts: {
    el: HTMLElement;
    sdk: GameSdkContract;
    resolvedConfig?: unknown;
    onReady?: () => void;
    onGameOver?: (finalScore: number) => void;
  }) => { destroy: () => void };
};
