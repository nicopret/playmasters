import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';
import { Button } from '../Button/Button';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  args: {
    variant: 'surface',
    padding: 'md',
    children: 'Arcade surface',
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Surface: Story = {};

export const Outline: Story = {
  args: { variant: 'outline', children: 'Outlined card with higher contrast border' },
};

export const Glow: Story = {
  args: { variant: 'glow', children: 'Neon glow card' },
};

export const WithContent: Story = {
  render: (args) => (
    <Card {...args} variant="glow" padding="lg" style={{ maxWidth: 480 }}>
      <h3 style={{ margin: 0 }}>Night League Finals</h3>
      <p style={{ margin: '8px 0 16px', color: 'var(--pm-color-text-secondary)' }}>
        Compete in the neon arena and climb the leaderboard. Matches start every hour.
      </p>
      <Button size="md">Join lobby</Button>
    </Card>
  ),
};
