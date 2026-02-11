import { validateSchema } from './validateSchema';
import { SpaceBlasterSchema } from './index';

const gameValid = require('./__fixtures__/game-config.valid.json');
const gameInvalid = require('./__fixtures__/game-config.invalid.json');

describe('SpaceBlaster game config schema', () => {
  it('accepts a valid game config', () => {
    const result = validateSchema('GameConfig', SpaceBlasterSchema.gameConfig, gameValid);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects invalid game config', () => {
    const result = validateSchema('GameConfig', SpaceBlasterSchema.gameConfig, gameInvalid);
    expect(result.valid).toBe(false);
    expect(
      result.issues.some(
        (i) =>
          i.path.includes('defaultLives') ||
          i.path.includes('timing.comboWindowMs') ||
          i.path.includes('extra')
      )
    ).toBe(true);
  });
});
