import type { Announcement } from '@playmasters/types';
import { getActiveAnnouncements } from '../lib/announcements';
import { getAllGames } from '../lib/games';
import { LandingClient } from '../components/Landing/LandingClient';

const fallbackAnnouncements: Announcement[] = [
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

export default async function Page() {
  const announcements = await getActiveAnnouncements(5);
  const games = getAllGames();

  return (
    <LandingClient
      announcements={announcements}
      fallbackAnnouncements={fallbackAnnouncements}
      games={games}
    />
  );
}
