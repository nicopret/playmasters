import type { Meta, StoryObj } from '@storybook/react';
import { GameTile } from './GameTile';

const baseTile = {
  title: 'Neon Drift',
  href: '#',
  imageUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80',
  tags: ['Racing', 'Arcade'],
};

const meta: Meta<typeof GameTile> = {
  title: 'Components/GameTile',
  component: GameTile,
  args: baseTile,
};

export default meta;
type Story = StoryObj<typeof GameTile>;

export const Available: Story = {};

export const ComingSoon: Story = {
  args: { status: 'coming-soon', title: 'Starfall', tags: ['Co-op'] },
};

export const WithoutImage: Story = {
  args: { imageUrl: undefined, title: 'Mystery Vault' },
};

export const WithTags: Story = {
  args: { tags: ['Multiplayer', 'Ranked', '45 fps'] },
};

export const GamesGrid: Story = {
  render: () => {
    const tiles = [
      baseTile,
      { ...baseTile, title: 'Skyline Run', tags: ['Runner'], href: '#run' },
      { ...baseTile, title: 'Quantum Clash', tags: ['Arena', '3v3'], href: '#clash' },
      { ...baseTile, title: 'Synthwave Nights', status: 'coming-soon', tags: ['Music'] },
      { ...baseTile, title: 'Midnight Raid', imageUrl: undefined, tags: ['Stealth'] },
      { ...baseTile, title: 'Arcade Royale', tags: ['Battle'], href: '#royale' },
      { ...baseTile, title: 'Turbo Trails', tags: ['Time Trial'], href: '#trails' },
      { ...baseTile, title: 'Holo Blocks', tags: ['Puzzle'], href: '#blocks' },
    ];
    return (
      <div
        style={{
          display: 'grid',
          gap: '16px',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        }}
      >
        {tiles.map((tile) => (
          <GameTile key={tile.title} {...tile} />
        ))}
      </div>
    );
  },
};
