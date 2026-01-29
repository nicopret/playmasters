import type { Announcement } from '@playmasters/types';
import { getActiveAnnouncements } from '../lib/announcements';
import { LandingClient } from '../components/Landing/LandingClient';

const fallbackAnnouncements: Announcement[] = [
  {
    id: 'placeholder-1',
    title: 'Season 1: Neon Gauntlet',
    body: 'Daily tournaments, fresh maps, and leaderboard resets every Sunday.',
    imageUrl:
      'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
    ctaLabel: 'View schedule',
    ctaHref: '#',
    isActive: true,
    sortOrder: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'placeholder-2',
    title: 'Creator Spotlight',
    body: 'Community-built arenas rotating weekly. Submit yours to get featured.',
    imageUrl:
      'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1200&q=80',
    ctaLabel: 'Submit a map',
    ctaHref: '#',
    isActive: true,
    sortOrder: -1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'placeholder-3',
    title: 'Co-op Raids',
    body: 'Team up, beat the boss, and unlock limited neon cosmetics.',
    imageUrl:
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
    ctaLabel: 'Form a squad',
    ctaHref: '#',
    isActive: true,
    sortOrder: -2,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

const games = [
  { title: 'Neon Drift', tags: ['Racing', 'Arcade'] },
  { title: 'Quantum Clash', tags: ['Arena', '3v3'] },
  { title: 'Skyline Run', tags: ['Runner'] },
  { title: 'Synthwave Nights', tags: ['Music'] },
  { title: 'Turbo Trails', tags: ['Time Trial'] },
  { title: 'Holo Blocks', tags: ['Puzzle'] },
];

export default async function Page() {
  const announcements = await getActiveAnnouncements(5);

  return (
    <LandingClient
      announcements={announcements}
      fallbackAnnouncements={fallbackAnnouncements}
      games={games}
    />
  );
}
