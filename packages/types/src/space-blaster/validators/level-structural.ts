import { ValidationIssue } from '../schemas/validateSchema';

type Wave = { enemyId?: string; count?: number; spawnDelayMs?: number };
type LevelConfig = {
  levelId?: string;
  waves?: Wave[];
  boss?: {
    enabled?: boolean;
    bossEnemyId?: string;
    bossWaveIndex?: number;
  };
};

const issue = (
  levelId: string | undefined,
  path: string,
  message: string,
): ValidationIssue => ({
  severity: 'error',
  stage: 'structural',
  domain: 'LevelConfig',
  sourceId: levelId,
  path,
  message,
});

export function validateLevelStructure(level: LevelConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const levelId = level.levelId;

  const waves = level.waves ?? [];

  // 1) Level has >= 1 wave
  if (!Array.isArray(waves) || waves.length === 0) {
    issues.push(
      issue(
        levelId,
        'waves',
        `LevelConfig(levelId=${levelId ?? 'unknown'}) must contain at least 1 wave.`,
      ),
    );
    return issues; // further checks depend on waves
  }

  waves.forEach((w, wi) => {
    // Wave must have enemyId
    if (!w.enemyId) {
      issues.push(
        issue(
          `waves[${wi}]`,
          `waves[${wi}].enemyId`,
          `Wave[${wi}] must specify enemyId.`,
        ),
      );
    }

    // Count must be number/integer >= 0
    const count = w.count;
    if (count === undefined) {
      issues.push(
        issue(levelId, `waves[${wi}].count`, `Wave[${wi}] must specify count.`),
      );
    } else if (
      !Number.isFinite(count) ||
      !Number.isInteger(count) ||
      count < 0
    ) {
      issues.push(
        issue(
          levelId,
          `waves[${wi}].count`,
          `Wave[${wi}] enemy composition count must be an integer >= 0 (got ${count}).`,
        ),
      );
    }
  });

  // Wave must have total enemies > 0 (for all waves)
  waves.forEach((w, wi) => {
    const count = w.count ?? 0;
    if (count <= 0) {
      issues.push(
        issue(
          levelId,
          `waves[${wi}].count`,
          `Wave[${wi}] total enemy count must be > 0 (got ${count}).`,
        ),
      );
    }
  });

  // 3) Boss section validity (if present/enabled)
  const boss = level.boss;
  if (boss && boss.enabled) {
    const missing: string[] = [];
    if (!boss.bossEnemyId) missing.push('bossEnemyId');
    if (boss.bossWaveIndex === undefined) missing.push('bossWaveIndex');

    if (missing.length) {
      issues.push(
        issue(
          levelId,
          'boss',
          `LevelConfig(levelId=${levelId ?? 'unknown'}) boss is enabled but missing: ${missing.join(', ')}.`,
        ),
      );
    } else if (
      typeof boss.bossWaveIndex !== 'number' ||
      !Number.isInteger(boss.bossWaveIndex) ||
      boss.bossWaveIndex < 0 ||
      boss.bossWaveIndex >= waves.length
    ) {
      issues.push(
        issue(
          levelId,
          'boss.bossWaveIndex',
          `LevelConfig(levelId=${levelId ?? 'unknown'}) bossWaveIndex must be within [0..${waves.length - 1}] (got ${boss.bossWaveIndex}).`,
        ),
      );
    }
  }

  return issues;
}
