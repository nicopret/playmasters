import { validateSchema } from './validateSchema';
import { SpaceBlasterSchema } from './index';

const enemyValid = require('./__fixtures__/enemy-catalog.valid.json');
const enemyMissingId = require('./__fixtures__/enemy-catalog.invalid-missing-id.json');
const enemyHpZero = require('./__fixtures__/enemy-catalog.invalid-hp.json');

describe('SpaceBlaster enemy catalog schema', () => {
  it('accepts a valid enemy catalog', () => {
    const result = validateSchema('EnemyCatalog', SpaceBlasterSchema.enemyCatalog, enemyValid);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects missing enemyId', () => {
    const result = validateSchema('EnemyCatalog', SpaceBlasterSchema.enemyCatalog, enemyMissingId);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes('enemyId'))).toBe(true);
  });

  it('rejects hp <= 0', () => {
    const result = validateSchema('EnemyCatalog', SpaceBlasterSchema.enemyCatalog, enemyHpZero);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path.includes('entries.0.hp'))).toBe(true);
  });
});
