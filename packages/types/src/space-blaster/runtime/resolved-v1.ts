type JsonObject = Record<string, unknown>;

export type GameConfigV1 = JsonObject;
export type LevelConfigV1 = JsonObject & { levelId?: string };
export type ScoreConfigV1 = JsonObject;
export type EnemyCatalogV1 = JsonObject;
export type HeroCatalogV1 = JsonObject;
export type AmmoCatalogV1 = JsonObject;
export type FormationLayoutsV1 = JsonObject;

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
  gameConfig: GameConfigV1;
  levelConfigs: LevelConfigV1[];
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
