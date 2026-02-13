type JsonObject = Record<string, unknown>;

export type ResolvedGameConfigV1 = JsonObject;
export type ResolvedLevelConfigV1 = JsonObject & { levelId?: string };
export type ResolvedScoreConfigV1 = JsonObject;
export type ResolvedEnemyCatalogV1 = JsonObject;
export type ResolvedHeroCatalogV1 = JsonObject;
export type ResolvedAmmoCatalogV1 = JsonObject;
export type ResolvedFormationLayoutsV1 = JsonObject;

export type ResolvedSpaceBlasterBundleV1 = {
  gameConfig: ResolvedGameConfigV1;
  enemyCatalog: ResolvedEnemyCatalogV1;
  heroCatalog: ResolvedHeroCatalogV1;
  ammoCatalog: ResolvedAmmoCatalogV1;
  formationLayouts: ResolvedFormationLayoutsV1;
  scoreConfig: ResolvedScoreConfigV1;
  levels: ResolvedLevelConfigV1[];
};

export type SpaceBlasterRuntimeResolverResponseV1 = {
  versionId: string;
  configHash: string;
  bundle: ResolvedSpaceBlasterBundleV1;
};
