import type {
  EnemyCatalogEntryV1,
  ResolvedGameConfigV1,
  ResolvedLevelConfigV1,
} from '@playmasters/types';

export type SpaceBlasterRuntimeConfigContractV1 = ResolvedGameConfigV1;

export function getLevelWaveCount(level: ResolvedLevelConfigV1): number {
  return level.waves?.length ?? 0;
}

export function getEnemyIds(catalog: EnemyCatalogEntryV1[]): string[] {
  return catalog.map((entry) => entry.enemyId);
}
