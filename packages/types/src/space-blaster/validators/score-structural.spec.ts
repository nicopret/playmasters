import { validateScoreConfigTiers } from './score-structural';
import type { ValidationIssue } from '../schemas/validateSchema';

const validScore = require('../samples/v1/score-config.v1.json');

describe('validateScoreConfigTiers', () => {
  it('passes a valid score config', () => {
    const issues = validateScoreConfigTiers(validScore);
    expect(issues).toHaveLength(0);
  });

  it('fails when tiers are not sorted by minCount', () => {
    const issues = validateScoreConfigTiers({
      ...validScore,
      combo: {
        ...validScore.combo,
        tiers: [
          { minCount: 2, multiplier: 1.2, name: 'double' },
          { minCount: 1, multiplier: 1.5, name: 'oops' },
        ],
      },
    });
    expect(
      issues.some((i: ValidationIssue) => i.path === 'combo.tiers[1].minCount'),
    ).toBe(true);
  });

  it('fails when tiers contain duplicate minCount', () => {
    const issues = validateScoreConfigTiers({
      ...validScore,
      combo: {
        ...validScore.combo,
        tiers: [
          { minCount: 2, multiplier: 1.2, name: 'double' },
          { minCount: 2, multiplier: 1.4, name: 'duplicate' },
        ],
      },
    });
    expect(
      issues.some((i: ValidationIssue) => i.message.includes('duplicate')),
    ).toBe(true);
  });

  it('fails when multiplier is below 1.0', () => {
    const issues = validateScoreConfigTiers({
      ...validScore,
      combo: {
        ...validScore.combo,
        tiers: [{ minCount: 2, multiplier: 0.9, name: 'low' }],
      },
    });
    expect(
      issues.some(
        (i: ValidationIssue) => i.path === 'combo.tiers[0].multiplier',
      ),
    ).toBe(true);
  });

  it('fails when tierBonus is negative', () => {
    const issues = validateScoreConfigTiers({
      ...validScore,
      combo: {
        ...validScore.combo,
        tiers: [
          { minCount: 2, multiplier: 1.1, tierBonus: -5, name: 'badbonus' },
        ],
      },
    });
    expect(
      issues.some(
        (i: ValidationIssue) => i.path === 'combo.tiers[0].tierBonus',
      ),
    ).toBe(true);
  });

  it('passes boundary values multiplier=1.0 tierBonus=0', () => {
    const issues = validateScoreConfigTiers({
      ...validScore,
      combo: {
        ...validScore.combo,
        tiers: [{ minCount: 1, multiplier: 1.0, tierBonus: 0, name: 'base' }],
      },
    });
    expect(issues).toHaveLength(0);
  });
});
