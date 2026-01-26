import type { Preview } from '@storybook/react';

import '@playmasters/brand/tokens.css';
import '@playmasters/brand/fonts.css';
import '../src/storybook.css';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'midnight',
      values: [
        { name: 'midnight', value: 'var(--pm-color-background)' },
        { name: 'surface', value: 'var(--pm-color-surface)' },
      ],
    },
  },
  decorators: [
    (Story) => (
      <div className="pm-story-root">
        <Story />
      </div>
    ),
  ],
};

export default preview;
