export type LeaderboardScope = 'global' | 'local' | 'personal';

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  countryCode?: string;
  score: number;
  achievedAt: string;
};

export type LeaderboardState = {
  gameId: string;
  scope: LeaderboardScope;
  countryCode?: string;
  entries: LeaderboardEntry[];
  updatedAt: string;
};

export type WsClientMessage =
  | {
      type: 'subscribe';
      gameId: string;
      scopes: Array<'global' | 'local' | 'personal'>;
      countryCode?: string;
      userId?: string;
    }
  | { type: 'unsubscribe'; gameId: string }
  | { type: 'ping' };

export type WsServerMessage =
  | { type: 'ready' }
  | { type: 'leaderboard:state'; payload: LeaderboardState }
  | { type: 'leaderboard:update'; payload: LeaderboardState }
  | { type: 'error'; message: string };
