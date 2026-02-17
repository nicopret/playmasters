import { validateScoreConfigDraft } from './validateScoreConfigDraft';

describe('validateScoreConfigDraft (base enemy scores)', () => {
  const catalogs = {
    enemies: [
      { enemyId: 'enemy-grunt', displayName: 'Grunt' },
      { enemyId: 'enemy-elite', displayName: 'Elite' },
    ],
  };

  it('flags missing score rows for catalog enemies as blocking errors', () => {
    const issues = validateScoreConfigDraft(
      {
        baseEnemyScores: [{ enemyId: 'enemy-grunt', score: 100 }],
        levelScoreMultiplier: { base: 1, perLevel: 0.1, max: 2 },
      },
      catalogs,
    );

    expect(
      issues.some(
        (i) =>
          i.path === 'baseEnemyScores[enemy-elite]' &&
          i.message.includes('Missing base score'),
      ),
    ).toBe(true);
  });

  it('rejects negative scores', () => {
    const issues = validateScoreConfigDraft(
      {
        baseEnemyScores: [
          { enemyId: 'enemy-grunt', score: -1 },
          { enemyId: 'enemy-elite', score: 20 },
        ],
        levelScoreMultiplier: { base: 1, perLevel: 0.1, max: 2 },
      },
      catalogs,
    );

    expect(
      issues.some(
        (i) =>
          i.path === 'baseEnemyScores[enemy-grunt].score' &&
          i.message === 'Score must be >= 0.',
      ),
    ).toBe(true);
  });

  it('flags rows that reference enemy ids missing from published enemy catalog', () => {
    const issues = validateScoreConfigDraft(
      {
        baseEnemyScores: [
          { enemyId: 'enemy-grunt', score: 10 },
          { enemyId: 'enemy-elite', score: 20 },
          { enemyId: 'enemy-ghost', score: 30 },
        ],
        levelScoreMultiplier: { base: 1, perLevel: 0.1, max: 2 },
      },
      catalogs,
    );

    expect(
      issues.some(
        (i) =>
          i.path === 'baseEnemyScores[2].enemyId' &&
          i.message.includes(
            "enemyId 'enemy-ghost' not found in EnemyCatalog.",
          ),
      ),
    ).toBe(true);
  });
});

describe('validateScoreConfigDraft (level multiplier)', () => {
  const catalogs = {
    enemies: [{ enemyId: 'enemy-grunt', displayName: 'Grunt' }],
  };

  const baseDraft = {
    baseEnemyScores: [{ enemyId: 'enemy-grunt', score: 100 }],
  };

  it('rejects negative base multiplier', () => {
    const issues = validateScoreConfigDraft(
      {
        ...baseDraft,
        levelScoreMultiplier: { base: -1, perLevel: 0, max: 2 },
      },
      catalogs,
    );

    expect(
      issues.some(
        (i) =>
          i.path === 'levelScoreMultiplier.base' &&
          i.message === 'Base multiplier must be >= 0.',
      ),
    ).toBe(true);
  });

  it('rejects negative perLevel multiplier', () => {
    const issues = validateScoreConfigDraft(
      {
        ...baseDraft,
        levelScoreMultiplier: { base: 1, perLevel: -0.25, max: 2 },
      },
      catalogs,
    );

    expect(
      issues.some(
        (i) =>
          i.path === 'levelScoreMultiplier.perLevel' &&
          i.message === 'Per-level multiplier must be >= 0.',
      ),
    ).toBe(true);
  });

  it('rejects max multiplier below base multiplier', () => {
    const issues = validateScoreConfigDraft(
      {
        ...baseDraft,
        levelScoreMultiplier: { base: 2, perLevel: 0, max: 1.5 },
      },
      catalogs,
    );

    expect(
      issues.some(
        (i) =>
          i.path === 'levelScoreMultiplier.max' &&
          i.message === 'Max multiplier must be >= base multiplier.',
      ),
    ).toBe(true);
  });
});
