import type { ResolvedGameConfigV1 } from '../resolved-v1';

export type RuntimeConfigError = {
  code: 'CONFIG_INVALID';
  domain: string;
  path: string;
  message: string;
  details?: unknown;
};

type ValidationResult =
  | { ok: true; value: ResolvedGameConfigV1 }
  | { ok: false; errors: RuntimeConfigError[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const pushError = (
  errors: RuntimeConfigError[],
  domain: string,
  path: string,
  message: string,
  details?: unknown,
) => {
  errors.push({ code: 'CONFIG_INVALID', domain, path, message, details });
};

const getStringField = (
  obj: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = obj[key];
  return typeof value === 'string' ? value : undefined;
};

export function validateResolvedGameConfigV1(cfg: unknown): ValidationResult {
  const errors: RuntimeConfigError[] = [];
  if (!isRecord(cfg)) {
    pushError(errors, 'Root', '', 'ResolvedGameConfigV1 must be an object.');
    return { ok: false, errors };
  }

  const configHash = cfg['configHash'];
  if (typeof configHash !== 'string' || configHash.length === 0) {
    pushError(errors, 'Root', 'configHash', 'Missing configHash (string).');
  }

  const requiredDomains: Array<[keyof ResolvedGameConfigV1, string]> = [
    ['gameConfig', 'GameConfig'],
    ['levelConfigs', 'LevelConfig'],
    ['heroCatalog', 'HeroCatalog'],
    ['enemyCatalog', 'EnemyCatalog'],
    ['ammoCatalog', 'AmmoCatalog'],
    ['formationLayouts', 'FormationLayouts'],
    ['scoreConfig', 'ScoreConfig'],
  ];

  for (const [key, domain] of requiredDomains) {
    const value = cfg[key];
    const isValid =
      key === 'levelConfigs' ? Array.isArray(value) : isRecord(value);
    if (!isValid) {
      pushError(
        errors,
        domain,
        String(key),
        `Missing ${domain} domain object.`,
      );
    }
  }

  const levelConfigs = Array.isArray(cfg['levelConfigs'])
    ? cfg['levelConfigs']
    : [];
  if (levelConfigs.length === 0) {
    pushError(
      errors,
      'LevelConfig',
      'levelConfigs',
      'levelConfigs must contain at least 1 level.',
    );
  }

  const referencedLayoutIds = new Set<string>();
  const referencedEnemyIds = new Set<string>();

  levelConfigs.forEach((level, levelIdx) => {
    if (!isRecord(level)) {
      pushError(
        errors,
        'LevelConfig',
        `levelConfigs[${levelIdx}]`,
        'LevelConfig entry must be an object.',
      );
      return;
    }

    const layoutId = getStringField(level, 'layoutId');
    if (!layoutId) {
      pushError(
        errors,
        'LevelConfig',
        `levelConfigs[${levelIdx}].layoutId`,
        'Missing layoutId (string).',
      );
    } else {
      referencedLayoutIds.add(layoutId);
    }

    const waves = level['waves'];
    if (!Array.isArray(waves) || waves.length === 0) {
      pushError(
        errors,
        'LevelConfig',
        `levelConfigs[${levelIdx}].waves`,
        'LevelConfig must have at least 1 wave.',
      );
      return;
    }

    waves.forEach((wave, waveIdx) => {
      if (!isRecord(wave)) {
        pushError(
          errors,
          'LevelConfig',
          `levelConfigs[${levelIdx}].waves[${waveIdx}]`,
          'Wave entry must be an object.',
        );
        return;
      }

      const enemyId = getStringField(wave, 'enemyId');
      if (!enemyId) {
        pushError(
          errors,
          'LevelConfig',
          `levelConfigs[${levelIdx}].waves[${waveIdx}].enemyId`,
          'Missing enemyId (string).',
        );
      } else {
        referencedEnemyIds.add(enemyId);
      }

      const count = wave['count'];
      if (typeof count !== 'number' || Number.isNaN(count) || count < 0) {
        pushError(
          errors,
          'LevelConfig',
          `levelConfigs[${levelIdx}].waves[${waveIdx}].count`,
          'Wave count must be a number >= 0.',
          { got: count },
        );
      }
    });
  });

  const formationLayouts = isRecord(cfg['formationLayouts'])
    ? cfg['formationLayouts']
    : undefined;
  const rawLayoutEntries = formationLayouts?.['entries'];
  const layoutEntries = Array.isArray(rawLayoutEntries)
    ? rawLayoutEntries
    : [];
  const layoutIdSet = new Set(
    layoutEntries
      .filter(isRecord)
      .map((layout) => getStringField(layout, 'layoutId'))
      .filter((layoutId): layoutId is string => Boolean(layoutId)),
  );

  referencedLayoutIds.forEach((layoutId) => {
    if (!layoutIdSet.has(layoutId)) {
      pushError(
        errors,
        'FormationLayouts',
        'formationLayouts.entries',
        `layoutId '${layoutId}' referenced by levelConfigs is missing in FormationLayouts.`,
      );
    }
  });

  const enemyCatalog = isRecord(cfg['enemyCatalog'])
    ? cfg['enemyCatalog']
    : undefined;
  const rawEnemyEntries = enemyCatalog?.['entries'];
  const enemyEntries = Array.isArray(rawEnemyEntries)
    ? rawEnemyEntries
    : [];
  const enemyIdSet = new Set(
    enemyEntries
      .filter(isRecord)
      .map((entry) => getStringField(entry, 'enemyId'))
      .filter((enemyId): enemyId is string => Boolean(enemyId)),
  );

  referencedEnemyIds.forEach((enemyId) => {
    if (!enemyIdSet.has(enemyId)) {
      pushError(
        errors,
        'EnemyCatalog',
        'enemyCatalog.entries',
        `enemyId '${enemyId}' referenced by waves is missing in EnemyCatalog.`,
      );
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: cfg as unknown as ResolvedGameConfigV1 };
}

export function formatRuntimeConfigErrors(
  errors: RuntimeConfigError[],
): string {
  return errors.map((e) => `${e.domain} ${e.path}: ${e.message}`).join('\n');
}
