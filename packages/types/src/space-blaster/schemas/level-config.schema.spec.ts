import { validateSchema } from './validateSchema';
import { SpaceBlasterSchema } from './index';

const levelValid = require('./__fixtures__/level-config.valid.json');
const levelMissingLayout = require('./__fixtures__/level-config.invalid-missing-layout.json');
const levelInvalidWave = require('./__fixtures__/level-config.invalid-wave.json');

describe('SpaceBlaster level config schema', () => {
  it('accepts a valid level config', () => {
    const result = validateSchema('LevelConfig', SpaceBlasterSchema.levelConfig, levelValid);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects missing layoutId', () => {
    const result = validateSchema('LevelConfig', SpaceBlasterSchema.levelConfig, levelMissingLayout);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes('layoutId'))).toBe(true);
  });

  it('rejects invalid wave fields', () => {
    const result = validateSchema('LevelConfig', SpaceBlasterSchema.levelConfig, levelInvalidWave);
    expect(result.valid).toBe(false);
    expect(
      result.issues.some(
        (i) => i.path.includes('waves.0.enemyId') || i.path.includes('waves.0.count')
      )
    ).toBe(true);
  });
});
