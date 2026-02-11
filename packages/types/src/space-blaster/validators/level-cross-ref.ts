import { ValidationIssue } from '../schemas/validateSchema';

type LevelConfig = {
  levelId?: string;
  layoutId?: string;
  enemyTypes?: string[];
  waves?: { enemyId?: string }[];
  heroId?: string;
};

type CatalogEntry<T extends string> = { [K in T]?: string } & Record<string, unknown>;
type Catalog<T extends string> = { entries: Array<CatalogEntry<T>> };
type HeroCatalog = { entries: Array<{ heroId?: string; defaultAmmoId?: string }> };

type Context = {
  level: LevelConfig;
  formationLayouts: Catalog<'layoutId'>;
  enemyCatalog: Catalog<'enemyId'>;
  heroCatalog: HeroCatalog;
  ammoCatalog: Catalog<'ammoId'>;
};

const err = (
  levelId: string | undefined,
  path: string,
  message: string
): ValidationIssue => ({
  severity: 'error',
  stage: 'cross-reference',
  domain: 'LevelConfig',
  sourceId: levelId,
  path,
  message
});

function toSet<T extends string>(catalog: { entries: Array<CatalogEntry<T>> }, key: T): Set<string> {
  return new Set((catalog.entries || []).map((e) => e[key]).filter(Boolean) as string[]);
}

export function validateLevelConfigReferentialIntegrity(ctx: Context): ValidationIssue[] {
  const { level, formationLayouts, enemyCatalog, heroCatalog, ammoCatalog } = ctx;
  const issues: ValidationIssue[] = [];
  const levelId = level.levelId;

  // layoutId exists
  if (level.layoutId) {
    const layouts = toSet(formationLayouts, 'layoutId');
    if (!layouts.has(level.layoutId)) {
      issues.push(
        err(
          levelId,
          'layoutId',
          `LevelConfig(levelId=${levelId ?? 'unknown'}) references missing layoutId '${level.layoutId}'.`
        )
      );
    }
  }

  // enemyIds in waves
  const enemyIds = toSet(enemyCatalog, 'enemyId');
  (level.waves || []).forEach((w, i) => {
    if (!w.enemyId) return;
    if (!enemyIds.has(w.enemyId)) {
      issues.push(
        err(
          levelId,
          `waves[${i}].enemyId`,
          `LevelConfig(levelId=${levelId ?? 'unknown'}) references unknown enemyId '${w.enemyId}' at waves[${i}].enemyId.`
        )
      );
    }
  });

  // enemyIds in enemyTypes
  (level.enemyTypes || []).forEach((eId, i) => {
    if (!enemyIds.has(eId)) {
      issues.push(
        err(
          levelId,
          `enemyTypes[${i}]`,
          `LevelConfig(levelId=${levelId ?? 'unknown'}) references unknown enemyId '${eId}' at enemyTypes[${i}].`
        )
      );
    }
  });

  // heroId existence (conditional)
  const heroIds = toSet(heroCatalog, 'heroId');
  let heroId: string | undefined = level.heroId;
  if (heroId) {
    if (!heroIds.has(heroId)) {
      issues.push(
        err(
          levelId,
          'heroId',
          `LevelConfig(levelId=${levelId ?? 'unknown'}) references missing heroId '${heroId}'.`
        )
      );
      heroId = undefined; // avoid ammo lookup on missing hero
    }
  } else if (heroCatalog.entries.length === 1 && heroCatalog.entries[0].heroId) {
    heroId = heroCatalog.entries[0].heroId as string;
  }

  // ammoId via hero
  if (heroId) {
    const hero = heroCatalog.entries.find((h) => h.heroId === heroId);
    const ammoId = hero?.defaultAmmoId;
    if (ammoId) {
      const ammoIds = toSet(ammoCatalog, 'ammoId');
      if (!ammoIds.has(ammoId)) {
        issues.push(
          err(
            levelId,
            `heroCatalog(${heroId}).defaultAmmoId`,
            `HeroCatalog(heroId=${heroId}) references missing ammoId '${ammoId}'.`
          )
        );
      }
    }
  }

  return issues;
}
