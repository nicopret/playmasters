const { validateSchema } = require('./validateSchema');
const { SpaceBlasterSchema } = require('./index');

const heroValid = require('./__fixtures__/hero-catalog.valid.json');
const heroMissingId = require('./__fixtures__/hero-catalog.invalid-missing-id.json');
const heroSpriteType = require('./__fixtures__/hero-catalog.invalid-sprite-type.json');

const enemyValid = require('./__fixtures__/enemy-catalog.valid.json');
const enemyMissingId = require('./__fixtures__/enemy-catalog.invalid-missing-id.json');
const enemyHpZero = require('./__fixtures__/enemy-catalog.invalid-hp.json');

const ammoValid = require('./__fixtures__/ammo-catalog.valid.json');
const ammoBadCooldown = require('./__fixtures__/ammo-catalog.invalid-cooldown.json');
const ammoBadSpeed = require('./__fixtures__/ammo-catalog.invalid-speed.json');

describe('SpaceBlaster catalog schemas', () => {
  it('accepts valid hero catalog', () => {
    const result = validateSchema('HeroCatalog', SpaceBlasterSchema.heroCatalog, heroValid);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects hero catalog missing heroId', () => {
    const result = validateSchema('HeroCatalog', SpaceBlasterSchema.heroCatalog, heroMissingId);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes('heroId'))).toBe(true);
  });

  it('rejects hero catalog with non-string spriteKey', () => {
    const result = validateSchema('HeroCatalog', SpaceBlasterSchema.heroCatalog, heroSpriteType);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path.includes('entries.0.spriteKey'))).toBe(true);
  });

  it('accepts valid enemy catalog', () => {
    const result = validateSchema('EnemyCatalog', SpaceBlasterSchema.enemyCatalog, enemyValid);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects enemy catalog missing enemyId', () => {
    const result = validateSchema('EnemyCatalog', SpaceBlasterSchema.enemyCatalog, enemyMissingId);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes('enemyId'))).toBe(true);
  });

  it('rejects enemy catalog with hp <= 0', () => {
    const result = validateSchema('EnemyCatalog', SpaceBlasterSchema.enemyCatalog, enemyHpZero);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path.includes('entries.0.hp'))).toBe(true);
  });

  it('accepts valid ammo catalog', () => {
    const result = validateSchema('AmmoCatalog', SpaceBlasterSchema.ammoCatalog, ammoValid);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects ammo catalog with negative cooldown', () => {
    const result = validateSchema('AmmoCatalog', SpaceBlasterSchema.ammoCatalog, ammoBadCooldown);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path.includes('entries.0.fireCooldownMs'))).toBe(true);
  });

  it('rejects ammo catalog with negative speed', () => {
    const result = validateSchema('AmmoCatalog', SpaceBlasterSchema.ammoCatalog, ammoBadSpeed);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path.includes('entries.0.projectileSpeed'))).toBe(true);
  });
});
