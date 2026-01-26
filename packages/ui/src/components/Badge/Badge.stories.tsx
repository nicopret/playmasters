import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  title: 'Components/Badge',
  component: Badge,
  args: {
    variant: 'default',
    size: 'md',
    children: 'Badge',
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Variants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
      <Badge variant="default">Default</Badge>
      <Badge variant="info">Info</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="danger">Danger</Badge>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '12px' }}>
      <Badge size="sm">Small</Badge>
      <Badge size="md">Medium</Badge>
    </div>
  ),
};

export const InlineText: Story = {
  render: () => (
    <p style={{ fontSize: 'var(--pm-font-size-md)', color: 'var(--pm-color-text-secondary)' }}>
      Multiplayer now live <Badge variant="success">online</Badge> and ranked queues
      <Badge variant="info" size="sm" style={{ marginLeft: 8 }}>
        beta
      </Badge>
    </p>
  ),
};
