import { validateSchema } from './validateSchema';
import { SpaceBlasterSchema } from './index';

const formationValid = require('./__fixtures__/formation-layouts.valid.json');
const formationInvalid = require('./__fixtures__/formation-layouts.invalid.json');

describe('SpaceBlaster formation layouts schema', () => {
  it('accepts valid formation layouts', () => {
    const result = validateSchema('FormationLayouts', SpaceBlasterSchema.formationLayouts, formationValid);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects invalid formation layouts', () => {
    const result = validateSchema('FormationLayouts', SpaceBlasterSchema.formationLayouts, formationInvalid);
    expect(result.valid).toBe(false);
    expect(
      result.issues.some(
        (i) =>
          i.path.includes('entries.0.layoutId') ||
          i.path.includes('entries.0.rows') ||
          i.path.includes('entries.0.columns') ||
          i.path.includes('entries.0.spacing.x')
      )
    ).toBe(true);
  });
});
