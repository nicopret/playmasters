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
  combo?: {
    tiers: {
      minCount: number;
      multiplier: number;
      tierBonus?: number;
      name?: string;
    }[];
  };
  waveClearBonus?: {
    base: number;
    perLifeBonus: number;
  };
  accuracyBonus?: {
    thresholds: {
      minAccuracy: number;
      bonus: number;
    }[];
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

  const tiers = Array.isArray(draft.combo?.tiers) ? draft.combo?.tiers : [];
  const seenMinCount = new Set<number>();
  tiers.forEach((tier, idx) => {
    if (!Number.isFinite(tier.minCount) || tier.minCount < 1) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: `combo.tiers[${idx}].minCount`,
        message: 'minCount must be >= 1.',
      });
    }
    if (Number.isFinite(tier.minCount) && seenMinCount.has(tier.minCount)) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: `combo.tiers[${idx}].minCount`,
        message: `Duplicate minCount: ${tier.minCount}.`,
      });
    }
    if (Number.isFinite(tier.minCount)) {
      seenMinCount.add(tier.minCount);
    }

    if (!Number.isFinite(tier.multiplier) || tier.multiplier < 1) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: `combo.tiers[${idx}].multiplier`,
        message: 'Multiplier must be >= 1.',
      });
    }

    if (
      typeof tier.tierBonus !== 'undefined' &&
      (!Number.isFinite(tier.tierBonus) || tier.tierBonus < 0)
    ) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: `combo.tiers[${idx}].tierBonus`,
        message: 'Tier bonus must be >= 0.',
      });
    }
  });

  for (let i = 1; i < tiers.length; i += 1) {
    const prev = tiers[i - 1];
    const curr = tiers[i];
    if (
      Number.isFinite(prev.minCount) &&
      Number.isFinite(curr.minCount) &&
      curr.minCount <= prev.minCount
    ) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: `combo.tiers[${i}].minCount`,
        message: 'minCount must be strictly increasing.',
      });
    }
  }

  const waveClearBonus = draft.waveClearBonus;
  if (waveClearBonus) {
    if (!Number.isFinite(waveClearBonus.base) || waveClearBonus.base < 0) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: 'waveClearBonus.base',
        message: 'Must be >= 0.',
      });
    }
    if (
      !Number.isFinite(waveClearBonus.perLifeBonus) ||
      waveClearBonus.perLifeBonus < 0
    ) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: 'waveClearBonus.perLifeBonus',
        message: 'Must be >= 0.',
      });
    }
  }

  const accuracyThresholds = Array.isArray(draft.accuracyBonus?.thresholds)
    ? draft.accuracyBonus?.thresholds
    : [];
  const seenAccuracy = new Set<number>();
  accuracyThresholds.forEach((threshold, idx) => {
    if (
      !Number.isFinite(threshold.minAccuracy) ||
      threshold.minAccuracy < 0 ||
      threshold.minAccuracy > 1
    ) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: `accuracyBonus.thresholds[${idx}].minAccuracy`,
        message: 'Threshold must be between 0 and 1.',
      });
    }
    if (
      Number.isFinite(threshold.minAccuracy) &&
      seenAccuracy.has(threshold.minAccuracy)
    ) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: `accuracyBonus.thresholds[${idx}].minAccuracy`,
        message: `Duplicate threshold: ${threshold.minAccuracy}.`,
      });
    }
    if (Number.isFinite(threshold.minAccuracy)) {
      seenAccuracy.add(threshold.minAccuracy);
    }
    if (!Number.isFinite(threshold.bonus) || threshold.bonus < 0) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: `accuracyBonus.thresholds[${idx}].bonus`,
        message: 'Bonus must be >= 0.',
      });
    }
  });
  for (let i = 1; i < accuracyThresholds.length; i += 1) {
    const prev = accuracyThresholds[i - 1];
    const curr = accuracyThresholds[i];
    if (
      Number.isFinite(prev.minAccuracy) &&
      Number.isFinite(curr.minAccuracy) &&
      curr.minAccuracy <= prev.minAccuracy
    ) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: `accuracyBonus.thresholds[${i}].minAccuracy`,
        message: 'Thresholds must be in ascending order.',
      });
    }
  }

  return issues;
}
