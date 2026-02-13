import type {
  AmmoCatalogV1,
  EnemyCatalogV1,
  FormationLayoutsV1,
  HeroCatalogV1,
  ResolvedGameConfigV1,
  ResolvedLevelConfigV1,
  ScoreConfigV1,
} from './resolved-v1';

export type RuntimeConfigError = {
  code: 'CONFIG_INVALID';
  domain:
    | 'Root'
    | 'GameConfig'
    | 'LevelConfig'
    | 'EnemyCatalog'
    | 'HeroCatalog'
    | 'AmmoCatalog'
    | 'FormationLayouts'
    | 'ScoreConfig';
  path: string;
  message: string;
};

type LegacyResolvedShape = {
  levels?: ResolvedLevelConfigV1[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const ensureRecord = (
  value: unknown,
  domain: RuntimeConfigError['domain'],
  path: string,
  errors: RuntimeConfigError[],
): Record<string, unknown> | undefined => {
  if (isRecord(value)) return value;
  errors.push({
    code: 'CONFIG_INVALID',
    domain,
    path,
    message: `Missing ${path} domain.`,
  });
  return undefined;
};

const ensureArray = (
  value: unknown,
  domain: RuntimeConfigError['domain'],
  path: string,
  errors: RuntimeConfigError[],
): unknown[] | undefined => {
  if (Array.isArray(value)) return value;
  errors.push({
    code: 'CONFIG_INVALID',
    domain,
    path,
    message: `Missing ${path} domain.`,
  });
  return undefined;
};

const toIdSet = <T extends string>(
  entries: Array<Record<string, unknown>> | undefined,
  key: T,
): Set<string> =>
  new Set(
    (entries ?? [])
      .map((entry) => entry[key])
      .filter((value): value is string => typeof value === 'string'),
  );

export function validateResolvedGameConfigV1(
  value: unknown,
):
  | { ok: true; value: ResolvedGameConfigV1 }
  | { ok: false; errors: RuntimeConfigError[] } {
  const errors: RuntimeConfigError[] = [];

  if (!isRecord(value)) {
    return {
      ok: false,
      errors: [
        {
          code: 'CONFIG_INVALID',
          domain: 'Root',
          path: '',
          message: 'resolvedConfig must be an object.',
        },
      ],
    };
  }

  const normalized: Record<string, unknown> = { ...value };
  if (!Array.isArray(normalized['levelConfigs'])) {
    const legacyLevels = (value as LegacyResolvedShape).levels;
    if (Array.isArray(legacyLevels)) {
      normalized['levelConfigs'] = legacyLevels;
    }
  }

  if (
    typeof normalized['configHash'] !== 'string' ||
    normalized['configHash'].length === 0
  ) {
    errors.push({
      code: 'CONFIG_INVALID',
      domain: 'Root',
      path: 'configHash',
      message: 'Missing configHash (string).',
    });
  }

  const gameConfig = ensureRecord(
    normalized['gameConfig'],
    'GameConfig',
    'gameConfig',
    errors,
  );
  const levelConfigsUnknown = ensureArray(
    normalized['levelConfigs'],
    'LevelConfig',
    'levelConfigs',
    errors,
  );
  const heroCatalog = ensureRecord(
    normalized['heroCatalog'],
    'HeroCatalog',
    'heroCatalog',
    errors,
  );
  const enemyCatalog = ensureRecord(
    normalized['enemyCatalog'],
    'EnemyCatalog',
    'enemyCatalog',
    errors,
  );
  const ammoCatalog = ensureRecord(
    normalized['ammoCatalog'],
    'AmmoCatalog',
    'ammoCatalog',
    errors,
  );
  const formationLayouts = ensureRecord(
    normalized['formationLayouts'],
    'FormationLayouts',
    'formationLayouts',
    errors,
  );
  const scoreConfig = ensureRecord(
    normalized['scoreConfig'],
    'ScoreConfig',
    'scoreConfig',
    errors,
  );

  void gameConfig;

  const levelConfigs = (levelConfigsUnknown ?? []) as ResolvedLevelConfigV1[];
  if (Array.isArray(levelConfigsUnknown) && levelConfigsUnknown.length === 0) {
    errors.push({
      code: 'CONFIG_INVALID',
      domain: 'LevelConfig',
      path: 'levelConfigs',
      message: 'levelConfigs must include at least 1 level.',
    });
  }

  const layoutIds = toIdSet(
    (formationLayouts as FormationLayoutsV1 | undefined)?.entries as
      | Array<Record<string, unknown>>
      | undefined,
    'layoutId',
  );
  const enemyIds = toIdSet(
    (enemyCatalog as EnemyCatalogV1 | undefined)?.entries as
      | Array<Record<string, unknown>>
      | undefined,
    'enemyId',
  );
  const ammoIds = toIdSet(
    (ammoCatalog as AmmoCatalogV1 | undefined)?.entries as
      | Array<Record<string, unknown>>
      | undefined,
    'ammoId',
  );

  levelConfigs.forEach((level, levelIndex) => {
    const basePath = `levelConfigs[${levelIndex}]`;
    if (typeof level.layoutId !== 'string' || level.layoutId.length === 0) {
      errors.push({
        code: 'CONFIG_INVALID',
        domain: 'LevelConfig',
        path: `${basePath}.layoutId`,
        message: 'layoutId is required.',
      });
    } else if (layoutIds.size > 0 && !layoutIds.has(level.layoutId)) {
      errors.push({
        code: 'CONFIG_INVALID',
        domain: 'FormationLayouts',
        path: `${basePath}.layoutId`,
        message: `layoutId '${level.layoutId}' referenced by ${basePath} not found in FormationLayouts.`,
      });
    }

    if (!Array.isArray(level.waves) || level.waves.length === 0) {
      errors.push({
        code: 'CONFIG_INVALID',
        domain: 'LevelConfig',
        path: `${basePath}.waves`,
        message: 'LevelConfig must have at least 1 wave.',
      });
      return;
    }

    level.waves.forEach((wave, waveIndex) => {
      const wavePath = `${basePath}.waves[${waveIndex}]`;
      if (typeof wave.enemyId !== 'string' || wave.enemyId.length === 0) {
        errors.push({
          code: 'CONFIG_INVALID',
          domain: 'LevelConfig',
          path: `${wavePath}.enemyId`,
          message: 'enemyId is required.',
        });
      } else if (enemyIds.size > 0 && !enemyIds.has(wave.enemyId)) {
        errors.push({
          code: 'CONFIG_INVALID',
          domain: 'EnemyCatalog',
          path: `${wavePath}.enemyId`,
          message: `enemyId '${wave.enemyId}' not found in EnemyCatalog.`,
        });
      }
      if (wave.count !== undefined && wave.count < 1) {
        errors.push({
          code: 'CONFIG_INVALID',
          domain: 'LevelConfig',
          path: `${wavePath}.count`,
          message: 'Wave count must be >= 1 when provided.',
        });
      }
    });
  });

  const heroEntries = (heroCatalog as HeroCatalogV1 | undefined)?.entries ?? [];
  heroEntries.forEach((hero, heroIndex) => {
    if (!ammoIds.has(hero.defaultAmmoId)) {
      errors.push({
        code: 'CONFIG_INVALID',
        domain: 'AmmoCatalog',
        path: `heroCatalog.entries[${heroIndex}].defaultAmmoId`,
        message: `defaultAmmoId '${hero.defaultAmmoId}' not found in AmmoCatalog.`,
      });
    }
  });

  const baseEnemyScores =
    (scoreConfig as ScoreConfigV1 | undefined)?.baseEnemyScores ?? [];
  baseEnemyScores.forEach((entry, scoreIndex) => {
    if (!enemyIds.has(entry.enemyId)) {
      errors.push({
        code: 'CONFIG_INVALID',
        domain: 'ScoreConfig',
        path: `scoreConfig.baseEnemyScores[${scoreIndex}].enemyId`,
        message: `baseEnemyScores references unknown enemyId '${entry.enemyId}'.`,
      });
    }
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: normalized as unknown as ResolvedGameConfigV1 };
}

export const formatRuntimeConfigErrors = (
  errors: RuntimeConfigError[],
): string =>
  errors
    .map((error) => `${error.domain} ${error.path}: ${error.message}`)
    .join('\n');
