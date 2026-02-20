import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  createDefaultCoreAssetsDraft,
  getCoreAssetsDraft,
  saveCoreAssetsDraft,
  validateCoreAssetsDraft,
} from './coreAssets';

const sendMock = jest.fn();

jest.mock('../../lib/ddb', () => ({
  ddbDocClient: {
    send: (...args: unknown[]) => sendMock(...args),
  },
}));

describe('coreAssets validation', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('flags numeric constraints violations', () => {
    const draft = createDefaultCoreAssetsDraft('space-blaster');
    const hero = draft.definitions.find((d) => d.id === 'hero.playerShip');
    expect(hero).toBeDefined();
    if (!hero) return;
    hero.variables.moveSpeed = -1;

    const issues = validateCoreAssetsDraft(draft);
    expect(
      issues.some(
        (issue) =>
          issue.path.endsWith('variables.moveSpeed') &&
          issue.message.includes('>= 0'),
      ),
    ).toBe(true);
  });

  it('flags invalid fx references', () => {
    const draft = createDefaultCoreAssetsDraft('space-blaster');
    const hero = draft.definitions.find((d) => d.id === 'hero.playerShip');
    expect(hero).toBeDefined();
    if (!hero) return;
    hero.fx.defaultAmmoId = 'sfx.player.fire';

    const issues = validateCoreAssetsDraft(draft);
    expect(
      issues.some(
        (issue) =>
          issue.path.endsWith('fx.defaultAmmoId') &&
          issue.message.includes('must be one of: ammo'),
      ),
    ).toBe(true);
  });
});

describe('coreAssets persistence', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('returns default draft when no stored item exists', async () => {
    sendMock.mockResolvedValueOnce({});
    const draft = await getCoreAssetsDraft('space-blaster');
    expect(draft.gameId).toBe('space-blaster');
    expect(draft.definitions.length).toBeGreaterThan(10);
  });

  it('saves then loads draft via ddb commands', async () => {
    const store: { item?: Record<string, unknown> } = {};
    sendMock.mockImplementation(async (command: unknown) => {
      if (command instanceof PutCommand) {
        store.item = command.input.Item as Record<string, unknown>;
        return {};
      }
      if (command instanceof GetCommand) {
        return { Item: store.item };
      }
      return {};
    });

    const draft = createDefaultCoreAssetsDraft('space-blaster');
    draft.defaultTextureKey = 'default.space.background';
    const saved = await saveCoreAssetsDraft(draft);
    const loaded = await getCoreAssetsDraft('space-blaster');

    expect(saved.gameId).toBe('space-blaster');
    expect(loaded.definitions.length).toBe(saved.definitions.length);
    expect(loaded.defaultTextureKey).toBe('default.space.background');
  });
});
