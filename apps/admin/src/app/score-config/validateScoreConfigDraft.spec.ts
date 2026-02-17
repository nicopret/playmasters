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
