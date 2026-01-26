export type GameStatus = 'available' | 'coming-soon';

export type Game = {
  id: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  status: GameStatus;
  thumbnailUrl?: string;
};

const games: Game[] = [
  {
    id: 'game-neo-drift',
    slug: 'neon-drift',
    title: 'Neon Drift',
    description: 'Synthwave street racing through procedurally lit skylines.',
    tags: ['Racing', 'Arcade'],
    status: 'available',
  },
  {
    id: 'game-astro-defender',
    slug: 'astro-defender',
    title: 'Astro Defender',
    description: 'Defend the last orbital city against pixel-perfect swarms.',
    tags: ['Shooter', 'Retro'],
    status: 'available',
  },
  {
    id: 'game-quantum-clash',
    slug: 'quantum-clash',
    title: 'Quantum Clash',
    description: '3v3 arena with teleport pads, traps, and neon power cores.',
    tags: ['Arena', '3v3'],
    status: 'coming-soon',
  },
  {
    id: 'game-pixel-paddles',
    slug: 'pixel-paddles',
    title: 'Pixel Paddles',
    description: 'Pong reimagined with power-ups, portals, and chaos mode.',
    tags: ['Sports', 'Retro'],
    status: 'coming-soon',
  },
  {
    id: 'game-skyline-run',
    slug: 'skyline-run',
    title: 'Skyline Run',
    description: 'Endless rooftop runner with dynamic weather and drones.',
    tags: ['Runner', 'Speedrun'],
    status: 'coming-soon',
  },
  {
    id: 'game-holo-blocks',
    slug: 'holo-blocks',
    title: 'Holo Blocks',
    description: 'Tactile puzzle stacks with voxel physics and neon glow.',
    tags: ['Puzzle'],
    status: 'coming-soon',
  },
];

export const getGameBySlug = (slug: string): Game | undefined =>
  games.find((game) => game.slug === slug);

export const getAllGames = (): Game[] => games;

export default games;
