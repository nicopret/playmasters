import type { CoreAssetDraft } from '../../../../../../lib/coreAssets';
import { POST, patchSfxPresetInDraft } from './route';

const authMock = jest.fn();
const getCoreAssetsDraftMock = jest.fn();
const saveCoreAssetDefinitionMock = jest.fn();
const validateCoreAssetsDraftMock = jest.fn();
const getCoreAssetSpecMapMock = jest.fn();

jest.mock('../../../../../../auth', () => ({
  auth: () => authMock(),
}));

jest.mock('../../../../../../lib/coreAssets', () => ({
  getCoreAssetsDraft: (...args: unknown[]) => getCoreAssetsDraftMock(...args),
  saveCoreAssetDefinition: (...args: unknown[]) =>
    saveCoreAssetDefinitionMock(...args),
  validateCoreAssetsDraft: (...args: unknown[]) =>
    validateCoreAssetsDraftMock(...args),
  getCoreAssetSpecMap: (...args: unknown[]) => getCoreAssetSpecMapMock(...args),
}));

const createDraftFixture = (): CoreAssetDraft => ({
  gameId: 'space-blaster',
  schemaVersion: 'core-assets.v1',
  defaultTextureKey: 'default.space.background',
  updatedAt: '2026-01-01T00:00:00.000Z',
  definitions: [
    {
      id: 'sfx.player.fire',
      displayName: 'SFX Player Fire',
      kind: 'sfx',
      slots: [{ slotId: 'audioKey', label: 'Audio', media: 'audio' }],
      variables: { volume: 0.9, isMusic: false, presetJson: '' },
      fx: {},
    },
    {
      id: 'sfx.enemy.fire',
      displayName: 'SFX Enemy Fire',
      kind: 'sfx',
      slots: [{ slotId: 'audioKey', label: 'Audio', media: 'audio' }],
      variables: { volume: 0.9, isMusic: false, presetJson: 'keep-me' },
      fx: {},
    },
  ],
});

describe('sfx preset route', () => {
  beforeEach(() => {
    authMock.mockReset();
    getCoreAssetsDraftMock.mockReset();
    saveCoreAssetDefinitionMock.mockReset();
    validateCoreAssetsDraftMock.mockReset();
    getCoreAssetSpecMapMock.mockReset();

    authMock.mockResolvedValue({ user: { isAdmin: true } });
    validateCoreAssetsDraftMock.mockReturnValue([]);
    getCoreAssetSpecMapMock.mockReturnValue(
      new Map([
        [
          'sfx.player.fire',
          { kind: 'sfx', slots: [{ slotId: 'audioKey', media: 'audio' }] },
        ],
        [
          'sfx.enemy.fire',
          { kind: 'sfx', slots: [{ slotId: 'audioKey', media: 'audio' }] },
        ],
      ]),
    );
  });

  it('patches only the target definition presetJson', () => {
    const draft = createDraftFixture();
    const patched = patchSfxPresetInDraft(draft, {
      definitionId: 'sfx.player.fire',
      presetJson: '{"wave_type":0}',
    });

    const playerFire = patched.definitions.find(
      (definition) => definition.id === 'sfx.player.fire',
    );
    const enemyFire = patched.definitions.find(
      (definition) => definition.id === 'sfx.enemy.fire',
    );

    expect(playerFire?.variables.presetJson).toBe('{"wave_type":0}');
    expect(enemyFire?.variables.presetJson).toBe('keep-me');
  });

  it('patches target audio slot when uploadedFile is provided', () => {
    const draft = createDraftFixture();
    const patched = patchSfxPresetInDraft(draft, {
      definitionId: 'sfx.player.fire',
      presetJson: '{"wave_type":0}',
      slotId: 'audioKey',
      uploadedFile: {
        objectKey:
          'drafts/core-assets/space-blaster/sfx.player.fire/audioKey/abc.wav',
        fileName: 'player-fire.wav',
        contentType: 'audio/wav',
        uploadedAt: '2026-01-01T01:00:00.000Z',
      },
    });

    const playerFire = patched.definitions.find(
      (definition) => definition.id === 'sfx.player.fire',
    );
    expect(playerFire?.slots[0].file?.fileName).toBe('player-fire.wav');
    expect(playerFire?.slots[0].file?.contentType).toBe('audio/wav');
  });

  it('POST persists the patched draft', async () => {
    const draft = createDraftFixture();
    getCoreAssetsDraftMock.mockResolvedValue(draft);
    saveCoreAssetDefinitionMock.mockImplementation(
      async (nextDefinition) => nextDefinition,
    );

    const req = new Request(
      'http://localhost/api/games/space-blaster/assets/sfx-preset',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          definitionId: 'sfx.player.fire',
          presetJson: '{"wave_type":0}',
        }),
      },
    );

    const response = await POST(req, {
      params: Promise.resolve({ gameId: 'space-blaster' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(saveCoreAssetDefinitionMock).toHaveBeenCalledTimes(1);
    expect(saveCoreAssetDefinitionMock).toHaveBeenCalledWith({
      gameId: 'space-blaster',
      defaultTextureKey: 'default.space.background',
      definition: expect.objectContaining({
        id: 'sfx.player.fire',
        variables: expect.objectContaining({
          presetJson: '{"wave_type":0}',
        }),
      }),
    });
    expect(payload.definitionId).toBe('sfx.player.fire');
  });
});
