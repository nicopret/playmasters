import type { Meta, StoryObj } from '@storybook/react';
import { Carousel } from './Carousel';

const baseItems = [
  {
    id: '1',
    title: 'Arcade Royale',
    body: 'Squad up for the neon showdown. Matches every 10 minutes.',
    imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80',
    ctaLabel: 'Join lobby',
    ctaHref: '#',
  },
  {
    id: '2',
    title: 'Synthwave Nights',
    body: 'Endless runner event with weekly leaderboards.',
    imageUrl: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=800&q=80',
    ctaLabel: 'Practice',
    ctaHref: '#',
  },
  {
    id: '3',
    title: 'Co-op Heist',
    body: 'Pair up to crack the vault and escape unseen.',
    imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
    ctaLabel: 'Assemble crew',
    ctaHref: '#',
  },
];

const meta: Meta<typeof Carousel> = {
  title: 'Components/Carousel',
  component: Carousel,
  args: {
    items: baseItems,
  },
};

export default meta;
type Story = StoryObj<typeof Carousel>;

export const Default: Story = {};

export const FiveItems: Story = {
  args: {
    items: [
      ...baseItems,
      {
        id: '4',
        title: 'Speedrun Trials',
        body: 'Beat the clock across rotating maps.',
        ctaLabel: 'See maps',
        ctaHref: '#',
      },
      {
        id: '5',
        title: 'Creator Spotlight',
        body: 'Featured community-made levels this week.',
        ctaLabel: 'Browse',
        ctaHref: '#',
      },
      {
        id: '6',
        title: 'Overflow',
        body: 'This item is clamped by maxItems',
      },
    ],
  },
};

export const WithoutImages: Story = {
  args: {
    items: baseItems.map((item) => ({ ...item, imageUrl: undefined })),
  },
};

export const AutoplayOff: Story = {
  args: {
    autoPlay: false,
  },
};
