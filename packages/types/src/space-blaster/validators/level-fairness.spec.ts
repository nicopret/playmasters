import { validateLevelFairness } from './level-fairness';
import type { ValidationIssue } from '../schemas/validateSchema';

describe('validateLevelFairness', () => {
  const baseLevel = {
    levelId: 'level-fair',
    waves: [{ enemyId: 'enemy_grunt', count: 1 }],
    diveProbability: 0.5,
    shootProbability: 0.5,
    maxConcurrentDivers: 1,
    maxConcurrentShots: 2,
  };

  it('passes when within bounds', () => {
    const issues = validateLevelFairness(baseLevel);
    expect(issues).toHaveLength(0);
  });

  it('fails when probability < 0', () => {
    const issues = validateLevelFairness({
      ...baseLevel,
      diveProbability: -0.1,
    });
    expect(
      issues.some((i: ValidationIssue) => i.path === 'diveProbability'),
    ).toBe(true);
  });

  it('fails when probability > 1 (wave-level)', () => {
    const lvl = {
      ...baseLevel,
      waves: [{ enemyId: 'enemy_grunt', count: 1, shootProbability: 1.5 }],
    };
    const issues = validateLevelFairness(lvl);
    expect(
      issues.some(
        (i: ValidationIssue) => i.path === 'waves[0].shootProbability',
      ),
    ).toBe(true);
  });

  it('fails when caps are negative', () => {
    const issues = validateLevelFairness({
      ...baseLevel,
      maxConcurrentDivers: -1,
    });
    expect(
      issues.some((i: ValidationIssue) => i.path === 'maxConcurrentDivers'),
    ).toBe(true);
  });

  it('fails when turnRate exceeds cap while tracking enabled', () => {
    const issues = validateLevelFairness({
      ...baseLevel,
      trackingEnabled: true,
      turnRate: 10,
    });
    expect(issues.some((i: ValidationIssue) => i.path === 'turnRate')).toBe(
      true,
    );
  });

  it('passes when turnRate at boundary', () => {
    const issues = validateLevelFairness({
      ...baseLevel,
      trackingEnabled: true,
      turnRate: 6,
    });
    expect(issues).toHaveLength(0);
  });
});
