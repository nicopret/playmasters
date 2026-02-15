import type { EmbeddedGameSdk, ResolvedGameConfigV1 } from '@playmasters/types';

export type RuntimeConfigError = {
  code: 'CONFIG_INVALID';
  domain: string;
  path: string;
  message: string;
};

export type RunContext = {
  readonly sdk: EmbeddedGameSdk;
  readonly resolvedConfig: ResolvedGameConfigV1;
  readonly configHash: string;
  readonly versionHash?: string;
  readonly versionId?: string;
  readonly publishedAt?: string;
  readonly mountedAt: string;
  runId?: string;
  runRegistrationStarted: boolean;
  pendingResolvedConfig?: ResolvedGameConfigV1;
  pendingConfigHash?: string;
  pendingVersionHash?: string;
  hasPendingUpdate: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toIdSet = (entries: unknown, key: string): Set<string> => {
  if (!Array.isArray(entries)) return new Set<string>();
  return new Set(
    entries
      .filter((entry) => isRecord(entry) && typeof entry[key] === 'string')
      .map((entry) => (entry as Record<string, unknown>)[key] as string),
  );
};

const validateResolvedConfig = (
  value: unknown,
):
  | { ok: true; config: ResolvedGameConfigV1 }
  | { ok: false; errors: RuntimeConfigError[] } => {
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
  if (
    !Array.isArray(normalized['levelConfigs']) &&
    Array.isArray(normalized['levels'])
  ) {
    normalized['levelConfigs'] = normalized['levels'];
  }

  const requiredDomains = [
    'gameConfig',
    'levelConfigs',
    'heroCatalog',
    'enemyCatalog',
    'ammoCatalog',
    'formationLayouts',
    'scoreConfig',
  ] as const;

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

  requiredDomains.forEach((key) => {
    if (key === 'levelConfigs') {
      if (!Array.isArray(normalized[key])) {
        errors.push({
          code: 'CONFIG_INVALID',
          domain: 'Root',
          path: key,
          message: `Missing ${key} domain.`,
        });
      }
      return;
    }

    if (!isRecord(normalized[key])) {
      errors.push({
        code: 'CONFIG_INVALID',
        domain: 'Root',
        path: key,
        message: `Missing ${key} domain.`,
      });
    }
  });

  const levelConfigs = Array.isArray(normalized['levelConfigs'])
    ? normalized['levelConfigs']
    : [];
  if (levelConfigs.length === 0) {
    errors.push({
      code: 'CONFIG_INVALID',
      domain: 'LevelConfig',
      path: 'levelConfigs',
      message: 'levelConfigs must contain at least 1 level.',
    });
  }

  const layoutIds = toIdSet(
    isRecord(normalized['formationLayouts'])
      ? normalized['formationLayouts']['entries']
      : undefined,
    'layoutId',
  );
  const enemyIds = toIdSet(
    isRecord(normalized['enemyCatalog'])
      ? normalized['enemyCatalog']['entries']
      : undefined,
    'enemyId',
  );
  const ammoIds = toIdSet(
    isRecord(normalized['ammoCatalog'])
      ? normalized['ammoCatalog']['entries']
      : undefined,
    'ammoId',
  );

  levelConfigs.forEach((level, levelIdx) => {
    if (!isRecord(level)) {
      errors.push({
        code: 'CONFIG_INVALID',
        domain: 'LevelConfig',
        path: `levelConfigs[${levelIdx}]`,
        message: 'LevelConfig entry must be an object.',
      });
      return;
    }

    const layoutId = level['layoutId'];
    if (typeof layoutId !== 'string' || layoutId.length === 0) {
      errors.push({
        code: 'CONFIG_INVALID',
        domain: 'LevelConfig',
        path: `levelConfigs[${levelIdx}].layoutId`,
        message: 'Missing layoutId (string).',
      });
    } else if (!layoutIds.has(layoutId)) {
      errors.push({
        code: 'CONFIG_INVALID',
        domain: 'FormationLayouts',
        path: `levelConfigs[${levelIdx}].layoutId`,
        message: `layoutId '${layoutId}' referenced by levelConfigs is missing in FormationLayouts.`,
      });
    }

    const waves = level['waves'];
    if (!Array.isArray(waves) || waves.length === 0) {
      errors.push({
        code: 'CONFIG_INVALID',
        domain: 'LevelConfig',
        path: `levelConfigs[${levelIdx}].waves`,
        message: 'LevelConfig must have at least 1 wave.',
      });
      return;
    }

    waves.forEach((wave, waveIdx) => {
      if (!isRecord(wave)) {
        errors.push({
          code: 'CONFIG_INVALID',
          domain: 'LevelConfig',
          path: `levelConfigs[${levelIdx}].waves[${waveIdx}]`,
          message: 'Wave entry must be an object.',
        });
        return;
      }

      const enemyId = wave['enemyId'];
      if (typeof enemyId !== 'string' || enemyId.length === 0) {
        errors.push({
          code: 'CONFIG_INVALID',
          domain: 'LevelConfig',
          path: `levelConfigs[${levelIdx}].waves[${waveIdx}].enemyId`,
          message: 'Missing enemyId (string).',
        });
      } else if (!enemyIds.has(enemyId)) {
        errors.push({
          code: 'CONFIG_INVALID',
          domain: 'EnemyCatalog',
          path: `levelConfigs[${levelIdx}].waves[${waveIdx}].enemyId`,
          message: `enemyId '${enemyId}' referenced by waves is missing in EnemyCatalog.`,
        });
      }

      const count = wave['count'];
      if (count !== undefined && (typeof count !== 'number' || count < 1)) {
        errors.push({
          code: 'CONFIG_INVALID',
          domain: 'LevelConfig',
          path: `levelConfigs[${levelIdx}].waves[${waveIdx}].count`,
          message: 'Wave count must be a number >= 1 when provided.',
        });
      }
    });
  });

  const heroEntries = isRecord(normalized['heroCatalog'])
    ? normalized['heroCatalog']['entries']
    : undefined;
  if (!Array.isArray(heroEntries) || heroEntries.length === 0) {
    errors.push({
      code: 'CONFIG_INVALID',
      domain: 'HeroCatalog',
      path: 'heroCatalog.entries',
      message: 'heroCatalog must contain at least 1 hero entry.',
    });
  } else {
    heroEntries.forEach((hero, heroIdx) => {
      if (!isRecord(hero)) return;
      const defaultAmmoId = hero['defaultAmmoId'];
      if (typeof defaultAmmoId !== 'string' || defaultAmmoId.length === 0) {
        errors.push({
          code: 'CONFIG_INVALID',
          domain: 'HeroCatalog',
          path: `heroCatalog.entries[${heroIdx}].defaultAmmoId`,
          message: 'Missing defaultAmmoId (string).',
        });
      } else if (!ammoIds.has(defaultAmmoId)) {
        errors.push({
          code: 'CONFIG_INVALID',
          domain: 'AmmoCatalog',
          path: `heroCatalog.entries[${heroIdx}].defaultAmmoId`,
          message: `defaultAmmoId '${defaultAmmoId}' referenced by hero is missing in AmmoCatalog.`,
        });
      }
    });
  }

  const baseEnemyScores = isRecord(normalized['scoreConfig'])
    ? normalized['scoreConfig']['baseEnemyScores']
    : undefined;
  if (Array.isArray(baseEnemyScores)) {
    baseEnemyScores.forEach((entry, entryIdx) => {
      if (!isRecord(entry)) return;
      const enemyId = entry['enemyId'];
      if (
        typeof enemyId === 'string' &&
        enemyId.length > 0 &&
        !enemyIds.has(enemyId)
      ) {
        errors.push({
          code: 'CONFIG_INVALID',
          domain: 'ScoreConfig',
          path: `scoreConfig.baseEnemyScores[${entryIdx}].enemyId`,
          message: `enemyId '${enemyId}' in baseEnemyScores is missing in EnemyCatalog.`,
        });
      }
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, config: normalized as unknown as ResolvedGameConfigV1 };
};

export const formatRuntimeConfigErrors = (
  errors: RuntimeConfigError[],
): string =>
  errors
    .map((error) => `${error.domain} ${error.path}: ${error.message}`)
    .join('\n');

export const createRunContext = (opts: {
  sdk: EmbeddedGameSdk;
  resolvedConfig: unknown;
}): RunContext => {
  const { sdk, resolvedConfig } = opts;
  const validation = validateResolvedConfig(resolvedConfig);
  if (!validation.ok) {
    throw new Error(formatRuntimeConfigErrors(validation.errors));
  }

  return {
    sdk,
    resolvedConfig: validation.config,
    configHash: validation.config.configHash,
    versionHash: validation.config.versionHash,
    versionId: validation.config.versionId,
    publishedAt: validation.config.publishedAt,
    mountedAt: new Date().toISOString(),
    runId: undefined,
    runRegistrationStarted: false,
    hasPendingUpdate: false,
  };
};

export const applyIncomingConfigUpdate = (
  ctx: RunContext,
  nextResolvedConfig: unknown,
  onPendingUpdateDetected?: (info: {
    currentHash: string;
    nextHash: string;
  }) => void,
): boolean => {
  const validation = validateResolvedConfig(nextResolvedConfig);
  if (!validation.ok) return false;

  const next = validation.config;
  if (next.configHash === ctx.configHash) return false;

  ctx.pendingResolvedConfig = next;
  ctx.pendingConfigHash = next.configHash;
  ctx.pendingVersionHash = next.versionHash;
  ctx.hasPendingUpdate = true;
  onPendingUpdateDetected?.({
    currentHash: ctx.configHash,
    nextHash: next.configHash,
  });
  return true;
};

export const resolveConfigForNextRun = (
  ctx: RunContext,
): ResolvedGameConfigV1 => {
  if (ctx.pendingResolvedConfig) return ctx.pendingResolvedConfig;
  return ctx.resolvedConfig;
};
