import { validateLevelConfigReferentialIntegrity } from './level-cross-ref';
import { validateLevelStructure } from './level-structural';
import { validateLevelFairness } from './level-fairness';
import { validateScoreConfigTiers } from './score-structural';
import type { ValidationIssue } from '../schemas/validateSchema';

const base = require('./__fixtures__/bundle-base.json');

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

describe('validator fixtures (cross-reference, structural, fairness, score tiers)', () => {
  describe('cross-reference missing references', () => {
    it('fails when layoutId is missing in FormationLayouts', () => {
      const ctx = clone(base);
      ctx.level.layoutId = 'missing_layout';
      const issues = validateLevelConfigReferentialIntegrity(ctx);
      expect(
        issues.some(
          (i: ValidationIssue) =>
            i.path === 'layoutId' && i.message.includes('missing layoutId'),
        ),
      ).toBe(true);
    });

    it('fails when wave enemyId is missing in EnemyCatalog', () => {
      const ctx = clone(base);
      ctx.level.waves[0].enemyId = 'ghost';
      const issues = validateLevelConfigReferentialIntegrity(ctx);
      expect(
        issues.some(
          (i: ValidationIssue) =>
            i.path === 'waves[0].enemyId' && i.message.includes('enemyId'),
        ),
      ).toBe(true);
    });

    it('fails when heroId is missing in HeroCatalog', () => {
      const ctx = clone(base);
      ctx.level.heroId = 'unknown-hero';
      const issues = validateLevelConfigReferentialIntegrity(ctx);
      expect(
        issues.some(
          (i: ValidationIssue) =>
            i.path === 'heroId' && i.message.includes('missing heroId'),
        ),
      ).toBe(true);
    });

    it('fails when hero default ammoId missing in AmmoCatalog', () => {
      const ctx = clone(base);
      ctx.heroCatalog.entries[0].defaultAmmoId = 'ammo_missing';
      const issues = validateLevelConfigReferentialIntegrity(ctx);
      expect(
        issues.some(
          (i: ValidationIssue) =>
            i.path.includes('defaultAmmoId') &&
            i.message.includes('missing ammoId'),
        ),
      ).toBe(true);
    });
  });

  describe('structural level validations', () => {
    it('fails when waves array is empty', () => {
      const lvl = { ...clone(base).level, waves: [] };
      const issues = validateLevelStructure(lvl);
      expect(
        issues.some(
          (i: ValidationIssue) =>
            i.path === 'waves' && i.message.includes('at least 1 wave'),
        ),
      ).toBe(true);
    });
  });

  describe('fairness ranges', () => {
    it('fails when probability is out of range and caps are negative', () => {
      const lvl = {
        ...clone(base).level,
        diveProbability: 1.5,
        maxConcurrentDivers: -1,
      };
      const issues = validateLevelFairness(lvl);
      expect(
        issues.some(
          (i: ValidationIssue) =>
            i.path === 'diveProbability' && i.message.includes('[0..1]'),
        ),
      ).toBe(true);
      expect(
        issues.some(
          (i: ValidationIssue) =>
            i.path === 'maxConcurrentDivers' && i.message.includes('>= 0'),
        ),
      ).toBe(true);
    });
  });

  describe('score tier correctness', () => {
    it('fails when tiers are unsorted or duplicate or invalid ranges', () => {
      const cfg = clone(base).scoreConfig;
      cfg.combo.tiers = [
        { minCount: 2, multiplier: 1.2, name: 'two' },
        { minCount: 2, multiplier: 0.9, name: 'dup-low', tierBonus: -1 },
        { minCount: 1, multiplier: 1.1, name: 'unsorted' },
      ];
      const issues = validateScoreConfigTiers(cfg);
      expect(
        issues.some((i: ValidationIssue) =>
          i.message.includes('duplicate minCount'),
        ),
      ).toBe(true);
      expect(
        issues.some((i: ValidationIssue) =>
          i.message.includes('sorted by minCount'),
        ),
      ).toBe(true);
      expect(
        issues.some(
          (i: ValidationIssue) => i.path === 'combo.tiers[1].multiplier',
        ),
      ).toBe(true);
      expect(
        issues.some(
          (i: ValidationIssue) => i.path === 'combo.tiers[1].tierBonus',
        ),
      ).toBe(true);
    });
  });
});
