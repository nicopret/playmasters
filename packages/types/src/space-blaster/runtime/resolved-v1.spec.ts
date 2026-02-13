import type { ResolvedGameConfigV1 } from './resolved-v1';

describe('ResolvedGameConfigV1', () => {
  it('is self-contained and includes all runtime domains', () => {
    const resolved: ResolvedGameConfigV1 = {
      gameId: 'space-blaster',
      env: 'dev',
      configHash: 'hash-1',
      versionId: 'v1',
      publishedAt: '2026-02-13T00:00:00.000Z',
      gameConfig: {},
      levelConfigs: [{ levelId: 'level-1' }],
      heroCatalog: {},
      enemyCatalog: {},
      ammoCatalog: {},
      formationLayouts: {},
      scoreConfig: {},
    };

    expect(resolved.configHash).toBe('hash-1');
    expect(resolved.levelConfigs.length).toBe(1);
    expect(resolved.heroCatalog).toBeDefined();
    expect(resolved.enemyCatalog).toBeDefined();
    expect(resolved.ammoCatalog).toBeDefined();
    expect(resolved.formationLayouts).toBeDefined();
    expect(resolved.scoreConfig).toBeDefined();
  });
});
