import { ValidationIssue } from "../schemas/validateSchema";

const { validateLevelConfigReferentialIntegrity } =  require('./level-cross-ref');
const formationLayouts = require('../samples/v1/formation-layouts.v1.json');
const enemyCatalog = require('../samples/v1/enemy-catalog.v1.json');
const heroCatalog = require('../samples/v1/hero-catalog.v1.json');
const ammoCatalog = require('../samples/v1/ammo-catalog.v1.json');
const level1 = require('../samples/v1/level-1.v1.json');

describe('validateLevelConfigReferentialIntegrity', () => {
  it('passes for valid level referencing known ids', () => {
    const issues = validateLevelConfigReferentialIntegrity({
      level: { ...level1, levelId: 'level-1' },
      formationLayouts,
      enemyCatalog,
      heroCatalog,
      ammoCatalog
    });
    expect(issues).toHaveLength(0);
  });

  it('fails when layoutId missing in formations', () => {
    const issues = validateLevelConfigReferentialIntegrity({
      level: { ...level1, levelId: 'bad-layout', layoutId: 'missing_layout' },
      formationLayouts,
      enemyCatalog,
      heroCatalog,
      ammoCatalog
    });
    expect(issues.some((i: ValidationIssue) => i.path === 'layoutId')).toBe(true);
  });

  it('fails when wave enemyId not in enemy catalog', () => {
    const issues = validateLevelConfigReferentialIntegrity({
      level: {
        ...level1,
        levelId: 'bad-enemy',
        waves: [{ enemyId: 'unknown_enemy', count: 1, spawnDelayMs: 0 }]
      },
      formationLayouts,
      enemyCatalog,
      heroCatalog,
      ammoCatalog
    });
    expect(issues.some((i: ValidationIssue) => i.path === 'waves[0].enemyId')).toBe(true);
  });

  it('fails when heroId missing', () => {
    const issues = validateLevelConfigReferentialIntegrity({
      level: { ...level1, levelId: 'bad-hero', heroId: 'missing_hero' },
      formationLayouts,
      enemyCatalog,
      heroCatalog,
      ammoCatalog
    });
    expect(issues.some((i: ValidationIssue) => i.path === 'heroId')).toBe(true);
  });

  it('fails when hero default ammo not in ammo catalog', () => {
    const badHeroCatalog = {
      entries: [
        {
          ...heroCatalog.entries[0],
          defaultAmmoId: 'missing_ammo'
        }
      ]
    };
    const issues = validateLevelConfigReferentialIntegrity({
      level: { ...level1, levelId: 'bad-ammo' },
      formationLayouts,
      enemyCatalog,
      heroCatalog: badHeroCatalog,
      ammoCatalog
    });
    expect(
      issues.some(
        (i: ValidationIssue) =>
          i.path === `heroCatalog(${badHeroCatalog.entries[0].heroId}).defaultAmmoId`
      )
    ).toBe(true);
  });
});
