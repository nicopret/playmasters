import { ValidationIssue } from '../schemas/validateSchema';

type ComboTier = {
  minCount?: number;
  multiplier?: number;
  tierBonus?: number;
  [key: string]: unknown;
};

type ScoreConfig = {
  combo?: { tiers?: ComboTier[] };
  scoreConfigId?: string;
};

const issue = (
  path: string,
  message: string,
  sourceId?: string,
): ValidationIssue => ({
  severity: 'error',
  stage: 'structural',
  domain: 'ScoreConfig',
  sourceId,
  path,
  message,
});

export function validateScoreConfigTiers(
  scoreConfig: ScoreConfig,
): ValidationIssue[] {
  const sourceId = scoreConfig.scoreConfigId;
  const issues: ValidationIssue[] = [];
  const tiers = scoreConfig.combo?.tiers;

  if (!Array.isArray(tiers) || tiers.length === 0) {
    return issues; // schema validation should already catch this; avoid duplicate noise
  }

  const seenMin: Set<number> = new Set();

  tiers.forEach((tier, i) => {
    const { minCount, multiplier, tierBonus } = tier;

    if (typeof minCount === 'number') {
      if (seenMin.has(minCount)) {
        issues.push(
          issue(
            `combo.tiers[${i}].minCount`,
            `ScoreConfig tiers must not contain duplicate minCount values (duplicate: ${minCount}).`,
            sourceId,
          ),
        );
      }
      seenMin.add(minCount);
    }

    if (typeof multiplier !== 'undefined') {
      if (typeof multiplier !== 'number' || !Number.isFinite(multiplier)) {
        issues.push(
          issue(
            `combo.tiers[${i}].multiplier`,
            `ScoreConfig tier multiplier must be a finite number (tier index ${i}, got ${String(multiplier)}).`,
            sourceId,
          ),
        );
      } else if (multiplier < 1) {
        issues.push(
          issue(
            `combo.tiers[${i}].multiplier`,
            `ScoreConfig tier multiplier must be >= 1.0 (tier index ${i}, got ${multiplier}).`,
            sourceId,
          ),
        );
      }
    }

    if (typeof tierBonus !== 'undefined') {
      if (typeof tierBonus !== 'number' || !Number.isFinite(tierBonus)) {
        issues.push(
          issue(
            `combo.tiers[${i}].tierBonus`,
            `ScoreConfig tierBonus must be a finite number (tier index ${i}, got ${String(tierBonus)}).`,
            sourceId,
          ),
        );
      } else if (tierBonus < 0) {
        issues.push(
          issue(
            `combo.tiers[${i}].tierBonus`,
            `ScoreConfig tierBonus must be >= 0 (tier index ${i}, got ${tierBonus}).`,
            sourceId,
          ),
        );
      }
    }
  });

  // sorted ascending check (strictly increasing)
  for (let i = 1; i < tiers.length; i += 1) {
    const prev = tiers[i - 1].minCount;
    const curr = tiers[i].minCount;
    if (typeof curr === 'number' && typeof prev === 'number' && curr < prev) {
      issues.push(
        issue(
          `combo.tiers[${i}].minCount`,
          `ScoreConfig tiers must be sorted by minCount ascending (tier index ${i} has ${curr} after ${prev}).`,
          sourceId,
        ),
      );
    }
  }

  return issues;
}
