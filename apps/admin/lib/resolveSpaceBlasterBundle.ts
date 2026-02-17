import type {
  AmmoCatalogEntryV1,
  EnemyCatalogEntryV1,
  FormationLayoutEntryV1,
  HeroCatalogEntryV1,
  ResolvedLevelConfigV1,
  ResolvedSpaceBlasterBundleV1,
} from '@playmasters/types';

export type BundleResolutionErrorCode =
  | 'MISSING_LAYOUT'
  | 'MISSING_ENEMY'
  | 'MISSING_HERO'
  | 'MISSING_AMMO';

export interface BundleResolutionError {
  readonly code: BundleResolutionErrorCode;
  readonly message: string;
  readonly details: {
    readonly domain:
      | 'LevelConfig'
      | 'FormationLayouts'
      | 'EnemyCatalog'
      | 'HeroCatalog'
      | 'AmmoCatalog';
    readonly id: string;
    readonly fieldPath: string;
    readonly levelIndex?: number;
    readonly waveIndex?: number;
  };
}

export type BundleResolutionResult =
  | { ok: true; resolved: ResolvedSpaceBlasterBundleV1 }
  | { ok: false; error: BundleResolutionError };

type ResolvedWaveWithEnemy = {
  enemyId: string;
  count?: number;
  spawnDelayMs?: number;
  enemy: EnemyCatalogEntryV1;
};

type ResolvedLevelWithEmbeds = ResolvedLevelConfigV1 & {
  formationLayout: FormationLayoutEntryV1;
  enemyTypesResolved?: EnemyCatalogEntryV1[];
  waves: ResolvedWaveWithEnemy[];
  hero?: HeroCatalogEntryV1;
  heroAmmo?: AmmoCatalogEntryV1;
};

function asRecord(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

export function resolveSpaceBlasterBundle(
  input: unknown,
): BundleResolutionResult {
  const bundle = asRecord(input);
  const base = bundle as unknown as ResolvedSpaceBlasterBundleV1;

  const layouts = Array.isArray(base.formationLayouts?.entries)
    ? base.formationLayouts.entries
    : [];
  const enemies = Array.isArray(base.enemyCatalog?.entries)
    ? base.enemyCatalog.entries
    : [];
  const heroes = Array.isArray(base.heroCatalog?.entries)
    ? base.heroCatalog.entries
    : [];
  const ammos = Array.isArray(base.ammoCatalog?.entries)
    ? base.ammoCatalog.entries
    : [];
  const levels = Array.isArray(base.levelConfigs) ? base.levelConfigs : [];

  const layoutById = new Map(layouts.map((entry) => [entry.layoutId, entry]));
  const enemyById = new Map(enemies.map((entry) => [entry.enemyId, entry]));
  const heroById = new Map(heroes.map((entry) => [entry.heroId, entry]));
  const ammoById = new Map(ammos.map((entry) => [entry.ammoId, entry]));

  const resolvedLevels: ResolvedLevelWithEmbeds[] = [];

  for (let levelIndex = 0; levelIndex < levels.length; levelIndex += 1) {
    const level = levels[levelIndex] as ResolvedLevelConfigV1 & {
      heroId?: string;
      waves?: Array<{ enemyId: string; count?: number; spawnDelayMs?: number }>;
      enemyTypes?: string[];
    };
    const fieldPrefix = `levelConfigs[${levelIndex}]`;
    const layout = layoutById.get(level.layoutId);
    if (!layout) {
      return {
        ok: false,
        error: {
          code: 'MISSING_LAYOUT',
          message: `Missing formation layout '${level.layoutId}' referenced by level config.`,
          details: {
            domain: 'FormationLayouts',
            id: level.layoutId,
            fieldPath: `${fieldPrefix}.layoutId`,
            levelIndex,
          },
        },
      };
    }

    let resolvedHero: HeroCatalogEntryV1 | undefined;
    let resolvedAmmo: AmmoCatalogEntryV1 | undefined;
    if (typeof level.heroId === 'string' && level.heroId.length > 0) {
      resolvedHero = heroById.get(level.heroId);
      if (!resolvedHero) {
        return {
          ok: false,
          error: {
            code: 'MISSING_HERO',
            message: `Missing hero '${level.heroId}' referenced by level config.`,
            details: {
              domain: 'HeroCatalog',
              id: level.heroId,
              fieldPath: `${fieldPrefix}.heroId`,
              levelIndex,
            },
          },
        };
      }
      resolvedAmmo = ammoById.get(resolvedHero.defaultAmmoId);
      if (!resolvedAmmo) {
        return {
          ok: false,
          error: {
            code: 'MISSING_AMMO',
            message: `Missing ammo '${resolvedHero.defaultAmmoId}' referenced by hero '${resolvedHero.heroId}'.`,
            details: {
              domain: 'AmmoCatalog',
              id: resolvedHero.defaultAmmoId,
              fieldPath: `${fieldPrefix}.heroId.defaultAmmoId`,
              levelIndex,
            },
          },
        };
      }
    }

    const waves = Array.isArray(level.waves) ? level.waves : [];
    const resolvedWaves: ResolvedWaveWithEnemy[] = [];
    for (let waveIndex = 0; waveIndex < waves.length; waveIndex += 1) {
      const wave = waves[waveIndex] as {
        enemyId: string;
        count?: number;
        spawnDelayMs?: number;
      };
      const enemy = enemyById.get(wave.enemyId);
      if (!enemy) {
        return {
          ok: false,
          error: {
            code: 'MISSING_ENEMY',
            message: `Missing enemy '${wave.enemyId}' referenced by level wave.`,
            details: {
              domain: 'EnemyCatalog',
              id: wave.enemyId,
              fieldPath: `${fieldPrefix}.waves[${waveIndex}].enemyId`,
              levelIndex,
              waveIndex,
            },
          },
        };
      }
      resolvedWaves.push({
        ...wave,
        enemy,
      });
    }

    let enemyTypesResolved: EnemyCatalogEntryV1[] | undefined;
    if (Array.isArray(level.enemyTypes)) {
      enemyTypesResolved = [];
      for (
        let enemyTypeIndex = 0;
        enemyTypeIndex < level.enemyTypes.length;
        enemyTypeIndex += 1
      ) {
        const enemyId = level.enemyTypes[enemyTypeIndex] as string;
        const enemy = enemyById.get(enemyId);
        if (!enemy) {
          return {
            ok: false,
            error: {
              code: 'MISSING_ENEMY',
              message: `Missing enemy '${enemyId}' referenced by enemyTypes.`,
              details: {
                domain: 'EnemyCatalog',
                id: enemyId,
                fieldPath: `${fieldPrefix}.enemyTypes[${enemyTypeIndex}]`,
                levelIndex,
              },
            },
          };
        }
        enemyTypesResolved.push(enemy);
      }
    }

    resolvedLevels.push({
      ...level,
      waves: resolvedWaves,
      formationLayout: layout,
      ...(resolvedHero ? { hero: resolvedHero } : {}),
      ...(resolvedAmmo ? { heroAmmo: resolvedAmmo } : {}),
      ...(enemyTypesResolved ? { enemyTypesResolved } : {}),
    });
  }

  return {
    ok: true,
    resolved: {
      ...base,
      levelConfigs: resolvedLevels as unknown as ResolvedLevelConfigV1[],
    },
  };
}
