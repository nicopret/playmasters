export type Enemy = { enemyId: string; displayName?: string };

export type ValidationIssue = {
  severity: 'error' | 'warning';
  stage: 'structural' | 'cross-reference';
  domain: 'ScoreConfig';
  path: string;
  message: string;
};

export type ScoreConfigDraft = {
  baseEnemyScores: { enemyId: string; score: number }[];
  levelScoreMultiplier?: {
    base: number;
    perLevel: number;
    max: number;
  };
};

export function validateScoreConfigDraft(
  draft: ScoreConfigDraft,
  catalogs: { enemies: Enemy[] },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const rows = Array.isArray(draft.baseEnemyScores)
    ? draft.baseEnemyScores
    : [];
  const scoreByEnemy = new Map<string, number>();
  const seenEnemyIds = new Set<string>();
  const publishedEnemyIds = new Set(catalogs.enemies.map((e) => e.enemyId));

  rows.forEach((row, idx) => {
    const enemyId = row.enemyId?.trim?.() ?? '';
    if (!enemyId) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: `baseEnemyScores[${idx}].enemyId`,
        message: 'Enemy id is required.',
      });
      return;
    }
    if (seenEnemyIds.has(enemyId)) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: `baseEnemyScores[${idx}].enemyId`,
        message: `Duplicate base score row for enemyId '${enemyId}'.`,
      });
      return;
    }
    seenEnemyIds.add(enemyId);
    scoreByEnemy.set(enemyId, row.score);

    if (!publishedEnemyIds.has(enemyId)) {
      issues.push({
        severity: 'error',
        stage: 'cross-reference',
        domain: 'ScoreConfig',
        path: `baseEnemyScores[${idx}].enemyId`,
        message: `enemyId '${enemyId}' not found in EnemyCatalog.`,
      });
    }

    if (!Number.isFinite(row.score) || row.score < 0) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: `baseEnemyScores[${enemyId}].score`,
        message: 'Score must be >= 0.',
      });
    }
  });

  catalogs.enemies.forEach((enemy) => {
    if (!scoreByEnemy.has(enemy.enemyId)) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: `baseEnemyScores[${enemy.enemyId}]`,
        message: `Missing base score for enemyId '${enemy.enemyId}'.`,
      });
    }
  });

  const multiplier = draft.levelScoreMultiplier;
  if (multiplier) {
    if (!Number.isFinite(multiplier.base) || multiplier.base < 0) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: 'levelScoreMultiplier.base',
        message: 'Base multiplier must be >= 0.',
      });
    }
    if (!Number.isFinite(multiplier.perLevel) || multiplier.perLevel < 0) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: 'levelScoreMultiplier.perLevel',
        message: 'Per-level multiplier must be >= 0.',
      });
    }
    if (!Number.isFinite(multiplier.max) || multiplier.max < 0) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: 'levelScoreMultiplier.max',
        message: 'Max multiplier must be >= 0.',
      });
    }
    if (
      Number.isFinite(multiplier.base) &&
      Number.isFinite(multiplier.max) &&
      multiplier.max < multiplier.base
    ) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: 'levelScoreMultiplier.max',
        message: 'Max multiplier must be >= base multiplier.',
      });
    }
  }

  return issues;
}
