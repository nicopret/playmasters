import { validateSchema } from './validateSchema';
import { SpaceBlasterSchema } from './index';

const scoreValid = require('./__fixtures__/score-config.valid.json');
const scoreMissing = require('./__fixtures__/score-config.invalid-missing-required.json');
const scoreNegative = require('./__fixtures__/score-config.invalid-negative-values.json');

describe('SpaceBlaster score config schema', () => {
  it('accepts a valid score config', () => {
    const result = validateSchema('ScoreConfig', SpaceBlasterSchema.scoreConfig, scoreValid);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects when required top-level fields are missing', () => {
    const result = validateSchema('ScoreConfig', SpaceBlasterSchema.scoreConfig, scoreMissing);
    expect(result.valid).toBe(false);
    expect(
      result.issues.some(
        (i) => i.message.includes('baseEnemyScores') || i.message.includes('levelScoreMultiplier')
      )
    ).toBe(true);
  });

  it('rejects negative or zero values where not allowed', () => {
    const result = validateSchema('ScoreConfig', SpaceBlasterSchema.scoreConfig, scoreNegative);
    expect(result.valid).toBe(false);
    expect(
      result.issues.some(
        (i) =>
          i.path.includes('baseEnemyScores.0.score') ||
          i.path.includes('combo.tiers.0.minCount') ||
          i.path.includes('combo.tiers.0.multiplier') ||
          i.path.includes('combo.tiers.0.tierBonus') ||
          i.path.includes('combo.minWindowMs') ||
          i.path.includes('levelScoreMultiplier.base')
      )
    ).toBe(true);
  });
});
