import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
  args: {
    placeholder: 'Player1',
    label: 'Username',
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {};

export const WithHint: Story = {
  args: {
    hint: 'Shown to other players',
  },
};

export const ErrorState: Story = {
  args: {
    error: 'This name is already taken',
  },
};

export const WithRightSlot: Story = {
  args: {
    rightSlot: <span aria-hidden>🔍</span>,
    placeholder: 'Search games',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: 'Disabled',
  },
};
