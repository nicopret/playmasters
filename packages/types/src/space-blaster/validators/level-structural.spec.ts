import { validateLevelStructure } from './level-structural';
import type { ValidationIssue } from '../schemas/validateSchema';

const validLevel = require('../samples/v1/level-1.v1.json');

describe('validateLevelStructure', () => {
  it('passes a valid level', () => {
    const issues = validateLevelStructure({
      ...validLevel,
      levelId: 'level-valid',
    });
    expect(issues).toHaveLength(0);
  });

  it('fails when waves array is empty', () => {
    const issues = validateLevelStructure({
      ...validLevel,
      levelId: 'no-waves',
      waves: [],
    });
    expect(issues.some((i: ValidationIssue) => i.path === 'waves')).toBe(true);
  });

  it('fails when wave count is negative', () => {
    const issues = validateLevelStructure({
      ...validLevel,
      levelId: 'negative-count',
      waves: [{ enemyId: 'enemy_grunt', count: -1 }],
    });
    expect(
      issues.some((i: ValidationIssue) => i.path === 'waves[0].count'),
    ).toBe(true);
  });

  it('fails when wave total enemies is zero', () => {
    const issues = validateLevelStructure({
      ...validLevel,
      levelId: 'zero-count',
      waves: [{ enemyId: 'enemy_grunt', count: 0 }],
    });
    expect(
      issues.some((i: ValidationIssue) => i.message.includes('must be > 0')),
    ).toBe(true);
  });

  it('fails when boss enabled but missing fields', () => {
    const issues = validateLevelStructure({
      ...validLevel,
      levelId: 'boss-missing',
      boss: { enabled: true },
    });
    expect(issues.some((i: ValidationIssue) => i.path === 'boss')).toBe(true);
  });

  it('fails when bossWaveIndex is out of range', () => {
    const issues = validateLevelStructure({
      ...validLevel,
      levelId: 'boss-index',
      boss: { enabled: true, bossEnemyId: 'enemy_grunt', bossWaveIndex: 5 },
    });
    expect(
      issues.some((i: ValidationIssue) => i.path === 'boss.bossWaveIndex'),
    ).toBe(true);
  });

  it('passes when boss is properly configured', () => {
    const issues = validateLevelStructure({
      ...validLevel,
      levelId: 'boss-ok',
      boss: { enabled: true, bossEnemyId: 'enemy_grunt', bossWaveIndex: 0 },
    });
    expect(issues).toHaveLength(0);
  });
});
