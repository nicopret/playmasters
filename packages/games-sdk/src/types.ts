export type GameContext = {
  gameId: string;
  user?: {
    id: string;
    displayName: string;
  };
  countryCode?: string;
  realtimeWsUrl: string;
  apiBaseUrl?: string;
};

export type GameRun = {
  runId: string;
  startedAt: string;
};

export type ScoreSubmission = {
  gameId: string;
  sessionToken: string;
  runId: string;
  score: number;
  durationMs?: number;
};

export type GameSdk = {
  isAuthenticated?: boolean;
  startRun(): Promise<{ run: GameRun; sessionToken: string }>;
  submitScore(
    payload: Omit<ScoreSubmission, 'sessionToken' | 'runId' | 'gameId'> & {
      score: number;
      durationMs?: number;
    },
  ): Promise<void>;
};
