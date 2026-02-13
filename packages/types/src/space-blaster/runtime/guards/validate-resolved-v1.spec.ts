import { validateResolvedGameConfigV1 } from './validate-resolved-v1';

const validConfig = {
  configHash: 'hash-123',
  gameConfig: { defaultLives: 3, timing: { comboWindowMs: 500 } },
  levelConfigs: [
    {
      levelId: 'level-1',
      layoutId: 'layout-1',
      waves: [{ enemyId: 'enemy-1', count: 3 }],
    },
  ],
  heroCatalog: { entries: [{ heroId: 'hero-1', defaultAmmoId: 'ammo-1' }] },
  enemyCatalog: { entries: [{ enemyId: 'enemy-1' }] },
  ammoCatalog: { entries: [{ ammoId: 'ammo-1' }] },
  formationLayouts: { entries: [{ layoutId: 'layout-1' }] },
  scoreConfig: {
    baseEnemyScores: [],
    combo: {},
    levelScoreMultiplier: {},
    waveClearBonus: {},
  },
};

describe('validateResolvedGameConfigV1', () => {
  it('fails when a top-level domain is missing', () => {
    const missing = { ...validConfig };
    Reflect.deleteProperty(missing, 'enemyCatalog');
    const result = validateResolvedGameConfigV1(missing);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some(
          (e) => e.domain === 'EnemyCatalog' && e.path === 'enemyCatalog',
        ),
      ).toBe(true);
    }
  });

  it('fails when levelConfigs is empty', () => {
    const result = validateResolvedGameConfigV1({
      ...validConfig,
      levelConfigs: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some(
          (e) =>
            e.domain === 'LevelConfig' &&
            e.path === 'levelConfigs' &&
            e.message.includes('at least 1 level'),
        ),
      ).toBe(true);
    }
  });

  it('fails when configHash is invalid', () => {
    const result = validateResolvedGameConfigV1({
      ...validConfig,
      configHash: 123,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some(
          (e) => e.domain === 'Root' && e.path === 'configHash',
        ),
      ).toBe(true);
    }
  });

  it('fails when a level references unknown layoutId', () => {
    const result = validateResolvedGameConfigV1({
      ...validConfig,
      levelConfigs: [
        {
          levelId: 'level-1',
          layoutId: 'layout-missing',
          waves: [{ enemyId: 'enemy-1', count: 3 }],
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some(
          (e) =>
            e.domain === 'FormationLayouts' &&
            e.message.includes("layoutId 'layout-missing'"),
        ),
      ).toBe(true);
    }
  });
});
