import type { EmbeddedGameSdk, ResolvedGameConfigV1 } from '@playmasters/types';
import type { RunContext } from './runtime';

export type SpaceBlasterBootstrapDeps = {
  readonly ctx: RunContext;
  readonly sdk: EmbeddedGameSdk;
  readonly resolvedConfig: ResolvedGameConfigV1;
  readonly gameConfig: ResolvedGameConfigV1['gameConfig'];
  readonly levelConfigs: ResolvedGameConfigV1['levelConfigs'];
  readonly heroCatalog: ResolvedGameConfigV1['heroCatalog'];
  readonly enemyCatalog: ResolvedGameConfigV1['enemyCatalog'];
  readonly ammoCatalog: ResolvedGameConfigV1['ammoCatalog'];
  readonly formationLayouts: ResolvedGameConfigV1['formationLayouts'];
  readonly scoreConfig: ResolvedGameConfigV1['scoreConfig'];
};

export const createBootstrapDependencies = (
  ctx: RunContext,
): SpaceBlasterBootstrapDeps => ({
  ctx,
  sdk: ctx.sdk,
  resolvedConfig: ctx.resolvedConfig,
  gameConfig: ctx.resolvedConfig.gameConfig,
  levelConfigs: ctx.resolvedConfig.levelConfigs,
  heroCatalog: ctx.resolvedConfig.heroCatalog,
  enemyCatalog: ctx.resolvedConfig.enemyCatalog,
  ammoCatalog: ctx.resolvedConfig.ammoCatalog,
  formationLayouts: ctx.resolvedConfig.formationLayouts,
  scoreConfig: ctx.resolvedConfig.scoreConfig,
});
