import { ValidationIssue } from '../schemas/validateSchema';

type NumericPath = {
  path: string;
  value: unknown;
  description: string;
  check: (n: number) => boolean;
  message: (n: number) => string;
};

type WaveConfig = {
  diveProbability?: number;
  shootProbability?: number;
  [key: string]: unknown;
};

type LevelConfig = {
  levelId?: string;
  diveProbability?: number;
  shootProbability?: number;
  maxConcurrentDivers?: number;
  maxConcurrentShots?: number;
  trackingEnabled?: boolean;
  tracking?: { enabled?: boolean; turnRate?: number };
  turnRate?: number;
  waves?: WaveConfig[];
};

const MAX_TURN_RATE = 6; // conservative cap to prevent perfect tracking; adjust if a canonical constant exists

const issue = (
  levelId: string | undefined,
  path: string,
  message: string
): ValidationIssue => ({
  severity: 'error',
  stage: 'structural',
  domain: 'LevelConfig',
  sourceId: levelId,
  path,
  message
});

function collectProbabilities(level: LevelConfig): NumericPath[] {
  const probs: NumericPath[] = [];
  if (level.diveProbability !== undefined) {
    probs.push({
      path: 'diveProbability',
      value: level.diveProbability,
      description: 'diveProbability',
      check: (n) => n >= 0 && n <= 1,
      message: (n) => `Probability diveProbability must be within [0..1] (got ${n}).`
    });
  }
  if (level.shootProbability !== undefined) {
    probs.push({
      path: 'shootProbability',
      value: level.shootProbability,
      description: 'shootProbability',
      check: (n) => n >= 0 && n <= 1,
      message: (n) => `Probability shootProbability must be within [0..1] (got ${n}).`
    });
  }
  (level.waves || []).forEach((w, wi) => {
    if (w.diveProbability !== undefined) {
      probs.push({
        path: `waves[${wi}].diveProbability`,
        value: w.diveProbability,
        description: `waves[${wi}].diveProbability`,
        check: (n) => n >= 0 && n <= 1,
        message: (n) =>
          `Probability waves[${wi}].diveProbability must be within [0..1] (got ${n}).`
      });
    }
    if (w.shootProbability !== undefined) {
      probs.push({
        path: `waves[${wi}].shootProbability`,
        value: w.shootProbability,
        description: `waves[${wi}].shootProbability`,
        check: (n) => n >= 0 && n <= 1,
        message: (n) =>
          `Probability waves[${wi}].shootProbability must be within [0..1] (got ${n}).`
      });
    }
  });
  return probs;
}

function collectCaps(level: LevelConfig): NumericPath[] {
  const caps: NumericPath[] = [];
  if (level.maxConcurrentDivers !== undefined) {
    caps.push({
      path: 'maxConcurrentDivers',
      value: level.maxConcurrentDivers,
      description: 'maxConcurrentDivers',
      check: (n) => n >= 0,
      message: (n) => `Cap maxConcurrentDivers must be >= 0 (got ${n}).`
    });
  }
  if (level.maxConcurrentShots !== undefined) {
    caps.push({
      path: 'maxConcurrentShots',
      value: level.maxConcurrentShots,
      description: 'maxConcurrentShots',
      check: (n) => n >= 0,
      message: (n) => `Cap maxConcurrentShots must be >= 0 (got ${n}).`
    });
  }
  return caps;
}

function collectTurnRates(level: LevelConfig): NumericPath[] {
  const trs: NumericPath[] = [];
  const trackingEnabled =
    level.trackingEnabled === true ||
    (level.tracking && level.tracking.enabled === true) ||
    level.turnRate !== undefined ||
    (level.tracking && level.tracking.turnRate !== undefined);

  if (!trackingEnabled) {
    return trs;
  }

  const turnRate =
    level.turnRate !== undefined
      ? { path: 'turnRate', value: level.turnRate }
      : level.tracking?.turnRate !== undefined
        ? { path: 'tracking.turnRate', value: level.tracking.turnRate }
        : null;

  if (turnRate) {
    trs.push({
      path: turnRate.path,
      value: turnRate.value,
      description: turnRate.path,
      check: (n) => n >= 0 && n <= MAX_TURN_RATE,
      message: (n) =>
        `turnRate ${turnRate.path} must be within [0..${MAX_TURN_RATE}] to prevent perfect tracking (got ${n}).`
    });
  }

  return trs;
}

export function validateLevelFairness(level: LevelConfig): ValidationIssue[] {
  const levelId = level.levelId;
  const issues: ValidationIssue[] = [];

  const numericChecks = [
    ...collectProbabilities(level),
    ...collectCaps(level),
    ...collectTurnRates(level)
  ];

  numericChecks.forEach(({ path, value, check, message }) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      issues.push(
        issue(levelId, path, `${path} must be a finite number (got ${String(value)}).`)
      );
      return;
    }
    if (!check(value)) {
      issues.push(issue(levelId, path, message(value)));
    }
  });

  return issues;
}
