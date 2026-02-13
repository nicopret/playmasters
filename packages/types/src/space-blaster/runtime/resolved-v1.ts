import type {
  AmmoCatalogV1,
  EnemyCatalogV1,
  FormationLayoutsV1,
  HeroCatalogV1,
  ResolvedGameConfigDomainV1,
  ResolvedLevelConfigV1,
  ScoreConfigV1,
} from './domains-v1';

/**
 * Runtime-facing, self-contained contract for Space Blaster config resolution.
 * Add `ResolvedGameConfigV2` for breaking changes and keep V1 exports for compatibility.
 */
export interface ResolvedGameConfigV1 {
  configHash: string;
  versionHash?: string;
  versionId?: string;
  publishedAt?: string;
  env?: string;
  gameId?: 'space-blaster' | string;
  gameConfig: ResolvedGameConfigDomainV1;
  levelConfigs: ResolvedLevelConfigV1[];
  heroCatalog: HeroCatalogV1;
  enemyCatalog: EnemyCatalogV1;
  ammoCatalog: AmmoCatalogV1;
  formationLayouts: FormationLayoutsV1;
  scoreConfig: ScoreConfigV1;
}

export type ResolvedSpaceBlasterBundleV1 = ResolvedGameConfigV1;

export interface SpaceBlasterRuntimeResolverResponseV1 {
  versionId: string;
  configHash: string;
  bundle: ResolvedSpaceBlasterBundleV1;
}
