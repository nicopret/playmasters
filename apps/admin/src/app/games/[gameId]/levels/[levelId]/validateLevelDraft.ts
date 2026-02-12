export type ValidationIssue = {
  severity: 'error' | 'warning';
  stage: 'schema' | 'structural' | 'cross-reference' | 'fairness';
  domain: 'LevelConfig';
  path?: string;
  message: string;
};

type EnemyCatalog = { enemyId: string }[];
type LayoutCatalog = { layoutId: string }[];

type Wave = { enemies?: { enemyId?: string; count?: number }[] };

type Draft = {
  layoutId?: string;
  waves?: Wave[];
  fleetSpeed?: number;
  rampFactor?: number;
  descendStep?: number;
  maxConcurrentDivers?: number;
  maxConcurrentShots?: number;
  attackTickMs?: number;
  diveChancePerTick?: number;
  divePattern?: string;
  turnRate?: number;
  fireTickMs?: number;
  fireChancePerTick?: number;
};

const within = (v: number | undefined, min: number, max: number) =>
  v !== undefined && (v < min || v > max);

export function validateLevelDraft(
  draft: Draft,
  catalogs: { enemies: EnemyCatalog; layouts: LayoutCatalog },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (issue: ValidationIssue) => issues.push(issue);

  // Required layout
  if (!draft.layoutId) {
    add({
      severity: 'error',
      stage: 'schema',
      domain: 'LevelConfig',
      path: 'layoutId',
      message: 'layoutId is required.',
    });
  } else if (!catalogs.layouts.some((l) => l.layoutId === draft.layoutId)) {
    add({
      severity: 'error',
      stage: 'cross-reference',
      domain: 'LevelConfig',
      path: 'layoutId',
      message: `layoutId '${draft.layoutId}' is not in published FormationLayouts.`,
    });
  }

  const waves = draft.waves ?? [];
  if (waves.length === 0) {
    add({
      severity: 'error',
      stage: 'structural',
      domain: 'LevelConfig',
      path: 'waves',
      message: 'At least one wave is required.',
    });
  }

  waves.forEach((w, wi) => {
    const enemies = w.enemies ?? [];
    const counts = enemies.map((e) => e.count ?? 0);
    const negative = counts.some((c) => c < 0);
    const total = counts.reduce((s, c) => s + c, 0);
    if (negative) {
      add({
        severity: 'error',
        stage: 'structural',
        domain: 'LevelConfig',
        path: `waves[${wi}]`,
        message: `Wave ${wi + 1}: counts must be >= 0.`,
      });
    }
    if (total <= 0) {
      add({
        severity: 'error',
        stage: 'structural',
        domain: 'LevelConfig',
        path: `waves[${wi}]`,
        message: `Wave ${wi + 1} must contain at least one enemy.`,
      });
    }
    enemies.forEach((e, ei) => {
      if (!e.enemyId) {
        add({
          severity: 'error',
          stage: 'schema',
          domain: 'LevelConfig',
          path: `waves[${wi}].enemies[${ei}].enemyId`,
          message: `Wave ${wi + 1}: enemyId is required.`,
        });
      } else if (!catalogs.enemies.some((x) => x.enemyId === e.enemyId)) {
        add({
          severity: 'error',
          stage: 'cross-reference',
          domain: 'LevelConfig',
          path: `waves[${wi}].enemies[${ei}].enemyId`,
          message: `Wave ${wi + 1}: enemyId '${e.enemyId}' not found in EnemyCatalog.`,
        });
      }
    });
  });

  // Bounds / fairness
  const numericChecks: Array<[string, number | undefined, () => boolean, string]> = [
    ['fleetSpeed', draft.fleetSpeed, () => (draft.fleetSpeed ?? 0) < 0, 'Must be >= 0'],
    ['rampFactor', draft.rampFactor, () => within(draft.rampFactor, 0, 1), 'Must be between 0 and 1'],
    ['descendStep', draft.descendStep, () => (draft.descendStep ?? 0) < 0, 'Must be >= 0'],
    [
      'maxConcurrentDivers',
      draft.maxConcurrentDivers,
      () => (draft.maxConcurrentDivers ?? 0) < 0,
      'Must be >= 0',
    ],
    [
      'maxConcurrentShots',
      draft.maxConcurrentShots,
      () => (draft.maxConcurrentShots ?? 0) < 0,
      'Must be >= 0',
    ],
    ['attackTickMs', draft.attackTickMs, () => (draft.attackTickMs ?? 0) < 1, 'Must be at least 1 ms'],
    ['fireTickMs', draft.fireTickMs, () => (draft.fireTickMs ?? 0) < 1, 'Must be at least 1 ms'],
    [
      'diveChancePerTick',
      draft.diveChancePerTick,
      () => within(draft.diveChancePerTick, 0, 1),
      'Must be between 0 and 1',
    ],
    [
      'fireChancePerTick',
      draft.fireChancePerTick,
      () => within(draft.fireChancePerTick, 0, 1),
      'Must be between 0 and 1',
    ],
  ];
  numericChecks.forEach(([path, val, fn, msg]) => {
    if (val !== undefined && fn()) {
      add({
        severity: 'error',
        stage: 'fairness',
        domain: 'LevelConfig',
        path,
        message: `${path} ${msg}.`,
      });
    }
  });

  const trackingEnabled = draft.divePattern === 'track';
  const MAX_TURN_RATE = 10;
  if (trackingEnabled) {
    if (within(draft.turnRate, 0, MAX_TURN_RATE)) {
      add({
        severity: 'error',
        stage: 'fairness',
        domain: 'LevelConfig',
        path: 'turnRate',
        message: `turnRate must be between 0 and ${MAX_TURN_RATE} to prevent perfect tracking.`,
      });
    }
  }

  return issues;
}
