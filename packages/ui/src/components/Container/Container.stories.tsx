import type { Meta, StoryObj } from '@storybook/react';
import { Container } from './Container';
import { Card } from '../Card/Card';

const meta: Meta<typeof Container> = {
  title: 'Components/Container',
  component: Container,
  args: {
    size: 'lg',
    children: (
      <Card variant="surface" padding="md">
        Centered content
      </Card>
    ),
  },
};

export default meta;
type Story = StoryObj<typeof Container>;

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'grid', gap: '24px' }}>
      <Container {...args} size="sm">
        <Card padding="md">Small width</Card>
      </Container>
      <Container {...args} size="md">
        <Card padding="md">Medium width</Card>
      </Container>
      <Container {...args} size="lg">
        <Card padding="md">Large width</Card>
      </Container>
      <Container {...args} size="xl">
        <Card padding="md">XL width</Card>
      </Container>
    </div>
  ),
};

export const Nested: Story = {
  render: () => (
    <Container size="xl">
      <Card padding="lg">
        <h3 style={{ margin: 0 }}>Nested Layout</h3>
        <p style={{ marginTop: 8 }}>Inner containers manage readable line length.</p>
        <Container size="md">
          <Card padding="md">Inner content constrained to md</Card>
        </Container>
      </Card>
    </Container>
  ),
};

export const Centered: Story = {
  render: () => (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <Container size="sm">
        <Card padding="md">Centered using flex parent</Card>
      </Container>
    </div>
  ),
};
