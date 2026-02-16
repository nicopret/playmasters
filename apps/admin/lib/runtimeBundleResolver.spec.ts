import {
  resolveRuntimeBundle,
  type RuntimeResolverResult,
} from './runtimeBundleResolver';
import type { PublishedBundle } from './bundleStore';

function makeBundle(versionId: string): PublishedBundle {
  return {
    env: 'dev',
    versionId,
    configHash: `${versionId}-hash`,
    bundle: { levelConfigs: [] },
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function expectFailure(result: RuntimeResolverResult) {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error('expected resolver failure');
  }
  return result.error;
}

describe('resolveRuntimeBundle', () => {
  it('selects published bundle deterministically from pointer version', async () => {
    const getPointer = jest.fn().mockResolvedValue({
      env: 'dev',
      currentVersionId: 'v123',
    });
    const getPublishedBundle = jest.fn(
      async (_env: string, versionId: string) =>
        versionId === 'v123' ? makeBundle('v123') : null,
    );

    const result = await resolveRuntimeBundle({
      gameId: 'space-blaster',
      env: 'dev',
      getPointer,
      getPublishedBundle,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bundle.versionId).toBe('v123');
    expect(getPointer).toHaveBeenCalledTimes(1);
    expect(getPointer).toHaveBeenCalledWith('dev');
    expect(getPublishedBundle).toHaveBeenCalledTimes(1);
    expect(getPublishedBundle).toHaveBeenCalledWith('dev', 'v123');
  });

  it('returns safe missing pointer error when pointer is absent', async () => {
    const result = await resolveRuntimeBundle({
      gameId: 'space-blaster',
      env: 'prod',
      getPointer: jest.fn().mockResolvedValue(null),
      getPublishedBundle: jest.fn(),
    });

    const error = expectFailure(result);
    expect(error.code).toBe('MISSING_POINTER');
    expect(error.status).toBe(404);
    expect(error.details).toEqual({ gameId: 'space-blaster', env: 'prod' });
  });

  it('returns safe missing bundle error when pointer target does not exist', async () => {
    const getPublishedBundle = jest.fn().mockResolvedValue(null);
    const result = await resolveRuntimeBundle({
      gameId: 'space-blaster',
      env: 'dev',
      getPointer: jest.fn().mockResolvedValue({
        env: 'dev',
        currentVersionId: 'v404',
      }),
      getPublishedBundle,
    });

    const error = expectFailure(result);
    expect(error.code).toBe('MISSING_PUBLISHED_BUNDLE');
    expect(error.status).toBe(404);
    expect(error.details).toEqual({
      gameId: 'space-blaster',
      env: 'dev',
      versionId: 'v404',
    });
    expect(getPublishedBundle).toHaveBeenCalledTimes(1);
    expect(getPublishedBundle).toHaveBeenCalledWith('dev', 'v404');
  });
});
