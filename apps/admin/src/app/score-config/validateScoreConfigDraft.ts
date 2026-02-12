export type Enemy = { enemyId: string; displayName?: string };

export type ValidationIssue = {
  severity: 'error' | 'warning';
  stage: 'structural' | 'cross-reference' | 'fairness';
  domain: 'ScoreConfig';
  path: string;
  message: string;
};

export type ScoreConfigDraft = {
  baseEnemyScores: { enemyId: string; score: number }[];
  levelScoreMultiplier?: { base: number; perLevel: number; max: number };
  combo?: { tiers: { minCount: number; multiplier: number; tierBonus?: number }[] };
  waveClearBonus?: { base: number; perLifeBonus?: number };
  accuracyBonus?: { thresholds: { minAccuracy: number; bonus: number }[] };
};

export function validateScoreConfigDraft(
  draft: ScoreConfigDraft,
  catalogs: { enemies: Enemy[] },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Base scores
  const scoreMap = new Map(draft.baseEnemyScores?.map((r) => [r.enemyId, r.score]));
  catalogs.enemies.forEach((e) => {
    const score = scoreMap.get(e.enemyId);
    if (score === undefined) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: `baseEnemyScores[${e.enemyId}]`,
        message: `Missing base score for enemyId '${e.enemyId}'.`,
      });
    } else if (score < 0) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: `baseEnemyScores[${e.enemyId}]`,
        message: 'Score must be ≥ 0.',
      });
    }
  });

  // Level multiplier
  const mult = draft.levelScoreMultiplier ?? { base: 1, perLevel: 0, max: 1 };
  if (mult.base < 1) {
    issues.push({
      severity: 'error',
      stage: 'structural',
      domain: 'ScoreConfig',
      path: 'levelScoreMultiplier.base',
      message: 'Base multiplier must be ≥ 1.0.',
    });
  }
  if (mult.perLevel < 0) {
    issues.push({
      severity: 'error',
      stage: 'structural',
      domain: 'ScoreConfig',
      path: 'levelScoreMultiplier.perLevel',
      message: 'Per-level increment must be ≥ 0.',
    });
  }
  if (mult.max < mult.base) {
    issues.push({
      severity: 'error',
      stage: 'structural',
      domain: 'ScoreConfig',
      path: 'levelScoreMultiplier.max',
      message: 'Max multiplier must be ≥ base.',
    });
  }

  // Combo tiers
  const tiers = draft.combo?.tiers ?? [];
  let prevMin = 0;
  const seen = new Set<number>();
  tiers.forEach((t, idx) => {
    if (t.minCount < 1) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: `comboTiers[${idx}].minCount`,
        message: 'minCount must be ≥ previous tier.',
      });
    }
    if (t.minCount < prevMin) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: `comboTiers[${idx}].minCount`,
        message: 'minCount must be ≥ previous tier.',
      });
    }
    if (seen.has(t.minCount)) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: `comboTiers[${idx}].minCount`,
        message: 'Duplicate minCount values are not allowed.',
      });
    }
    seen.add(t.minCount);
    prevMin = t.minCount;
    if (t.multiplier < 1) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: `comboTiers[${idx}].multiplier`,
        message: 'Multiplier must be ≥ 1.',
      });
    }
    if ((t.tierBonus ?? 0) < 0) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: `comboTiers[${idx}].tierBonus`,
        message: 'Tier bonus must be ≥ 0.',
      });
    }
  });

  // Wave bonus
  const wave = draft.waveClearBonus ?? { base: 0, perLifeBonus: 0 };
  if (wave.base < 0) {
    issues.push({
      severity: 'error',
      stage: 'structural',
      domain: 'ScoreConfig',
      path: 'waveClearBonus.base',
      message: 'Base wave bonus must be ≥ 0.',
    });
  }
  if (wave.perLifeBonus !== undefined && wave.perLifeBonus < 0) {
    issues.push({
      severity: 'error',
      stage: 'structural',
      domain: 'ScoreConfig',
      path: 'waveClearBonus.perLifeBonus',
      message: 'Per-life wave bonus must be ≥ 0.',
    });
  }

  // Accuracy thresholds
  const thresholds = draft.accuracyBonus?.thresholds ?? [];
  let prevAcc = -1;
  const seenAcc = new Set<number>();
  thresholds.forEach((t, idx) => {
    if (t.minAccuracy < 0 || t.minAccuracy > 1) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: `accuracyThresholds[${idx}].minAccuracy`,
        message: 'Accuracy threshold must be between 0 and 1.',
      });
    }
    if (t.minAccuracy < prevAcc) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: `accuracyThresholds[${idx}].minAccuracy`,
        message: 'Thresholds must be sorted ascending.',
      });
    }
    if (seenAcc.has(t.minAccuracy)) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: `accuracyThresholds[${idx}].minAccuracy`,
        message: 'Duplicate thresholds are not allowed.',
      });
    }
    seenAcc.add(t.minAccuracy);
    prevAcc = t.minAccuracy;
    if (t.bonus < 0) {
      issues.push({
        severity: 'error',
        stage: 'structural',
        domain: 'ScoreConfig',
        path: `accuracyThresholds[${idx}].bonus`,
        message: 'Bonus must be ≥ 0.',
      });
    }
  });

  return issues;
}
