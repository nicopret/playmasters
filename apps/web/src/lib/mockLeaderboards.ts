import type { Game } from './games';

export type LeaderboardScope = 'global' | 'local' | 'personal';

export type LeaderboardEntry = {
  rank: number;
  player: string;
  score: number;
  country?: string;
  date: string;
};

export type LeaderboardData = Record<LeaderboardScope, LeaderboardEntry[]>;

const basePlayers = [
  { player: 'VaporWave', country: 'US' },
  { player: 'CRTWizard', country: 'GB' },
  { player: 'LaserLynx', country: 'CA' },
  { player: 'BitBlaster', country: 'DE' },
  { player: 'NeonNova', country: 'JP' },
  { player: 'PixelPilot', country: 'AU' },
  { player: 'SynthSam', country: 'SE' },
  { player: 'RetroRift', country: 'BR' },
];

const scoresByGame: Record<string, number[]> = {
  'neon-drift': [98765, 96440, 93210, 90110, 87650, 84210, 81000, 79880],
  'astro-defender': [75210, 73950, 72110, 70040, 68880, 67110, 66050],
};

const dates = ['2026-01-20', '2026-01-19', '2026-01-18', '2026-01-17', '2026-01-16'];

const buildEntries = (slug: string): LeaderboardEntry[] => {
  const scores = scoresByGame[slug];
  if (!scores) return [];

  return scores.slice(0, basePlayers.length).map((score, index) => ({
    rank: index + 1,
    player: basePlayers[index % basePlayers.length].player,
    country: basePlayers[index % basePlayers.length].country,
    score,
    date: dates[index % dates.length],
  }));
};

export const getMockLeaderboardsForGame = (game: Game): LeaderboardData => {
  if (game.status === 'coming-soon') {
    return {
      global: [],
      local: [],
      personal: [],
    };
  }

  const entries = buildEntries(game.slug);
  const localEntries = entries.slice().reverse();

  return {
    global: entries,
    local: localEntries,
    personal: [],
  };
};
