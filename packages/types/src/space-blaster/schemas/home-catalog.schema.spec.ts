import { validateSchema } from './validateSchema';
import { SpaceBlasterSchema } from './index';

const homeValid = require('./__fixtures__/home-catalog.valid.json');
const homeInvalid = require('./__fixtures__/home-catalog.invalid.json');

describe('SpaceBlaster home catalog schema', () => {
  it('accepts a valid home catalog entry', () => {
    const result = validateSchema('HomeCatalog', SpaceBlasterSchema.homeCatalog, homeValid);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects missing heroId', () => {
    const result = validateSchema('HomeCatalog', SpaceBlasterSchema.homeCatalog, homeInvalid);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes('heroId'))).toBe(true);
  });
});
