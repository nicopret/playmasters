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

    const enemyTypes = level['enemyTypes'];
    if (Array.isArray(enemyTypes)) {
      enemyTypes.forEach((enemyType, enemyTypeIdx) => {
        if (typeof enemyType === 'string' && enemyType.length > 0) {
          referencedEnemyIds.add(enemyType);
        } else {
          pushError(
            errors,
            'LevelConfig',
            `levelConfigs[${levelIdx}].enemyTypes[${enemyTypeIdx}]`,
            'enemyTypes entries must be non-empty strings.',
          );
        }
      });
    }
  });

  const formationLayouts = isRecord(cfg['formationLayouts'])
    ? cfg['formationLayouts']
    : undefined;
  const rawLayoutEntries = formationLayouts?.['entries'];
  const layoutEntries = Array.isArray(rawLayoutEntries) ? rawLayoutEntries : [];
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
  const enemyEntries = Array.isArray(rawEnemyEntries) ? rawEnemyEntries : [];
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

  const heroCatalog = isRecord(cfg['heroCatalog'])
    ? cfg['heroCatalog']
    : undefined;
  const rawHeroEntries = heroCatalog?.['entries'];
  const heroEntries = Array.isArray(rawHeroEntries) ? rawHeroEntries : [];
  if (heroEntries.length === 0) {
    pushError(
      errors,
      'HeroCatalog',
      'heroCatalog.entries',
      'heroCatalog must contain at least 1 hero entry.',
    );
  }

  const ammoCatalog = isRecord(cfg['ammoCatalog'])
    ? cfg['ammoCatalog']
    : undefined;
  const rawAmmoEntries = ammoCatalog?.['entries'];
  const ammoEntries = Array.isArray(rawAmmoEntries) ? rawAmmoEntries : [];
  const ammoIdSet = new Set(
    ammoEntries
      .filter(isRecord)
      .map((entry) => getStringField(entry, 'ammoId'))
      .filter((ammoId): ammoId is string => Boolean(ammoId)),
  );

  heroEntries.forEach((entry, heroIdx) => {
    if (!isRecord(entry)) {
      pushError(
        errors,
        'HeroCatalog',
        `heroCatalog.entries[${heroIdx}]`,
        'HeroCatalog entry must be an object.',
      );
      return;
    }

    const heroId = getStringField(entry, 'heroId');
    if (!heroId) {
      pushError(
        errors,
        'HeroCatalog',
        `heroCatalog.entries[${heroIdx}].heroId`,
        'Missing heroId (string).',
      );
    }

    const defaultAmmoId = getStringField(entry, 'defaultAmmoId');
    if (!defaultAmmoId) {
      pushError(
        errors,
        'HeroCatalog',
        `heroCatalog.entries[${heroIdx}].defaultAmmoId`,
        'Missing defaultAmmoId (string).',
      );
      return;
    }

    if (!ammoIdSet.has(defaultAmmoId)) {
      pushError(
        errors,
        'AmmoCatalog',
        `heroCatalog.entries[${heroIdx}].defaultAmmoId`,
        `defaultAmmoId '${defaultAmmoId}' referenced by hero '${heroId ?? heroIdx}' is missing in AmmoCatalog.`,
      );
    }
  });

  const scoreConfig = isRecord(cfg['scoreConfig'])
    ? cfg['scoreConfig']
    : undefined;
  const rawBaseEnemyScores = scoreConfig?.['baseEnemyScores'];
  const baseEnemyScores = Array.isArray(rawBaseEnemyScores)
    ? rawBaseEnemyScores
    : [];
  baseEnemyScores.forEach((entry, entryIdx) => {
    if (!isRecord(entry)) return;
    const enemyId = getStringField(entry, 'enemyId');
    if (enemyId && !enemyIdSet.has(enemyId)) {
      pushError(
        errors,
        'ScoreConfig',
        `scoreConfig.baseEnemyScores[${entryIdx}].enemyId`,
        `enemyId '${enemyId}' in baseEnemyScores is missing in EnemyCatalog.`,
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
