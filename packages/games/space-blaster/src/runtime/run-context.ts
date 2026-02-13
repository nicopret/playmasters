import type { EmbeddedGameSdk } from '@playmasters/types';

export type RuntimeConfigError = {
  code: 'CONFIG_INVALID';
  domain: string;
  path: string;
  message: string;
};

export type ResolvedGameConfig = {
  configHash: string;
  gameConfig: Record<string, unknown>;
  levelConfigs: unknown[];
  heroCatalog: Record<string, unknown>;
  enemyCatalog: Record<string, unknown>;
  ammoCatalog: Record<string, unknown>;
  formationLayouts: Record<string, unknown>;
  scoreConfig: Record<string, unknown>;
  versionHash?: string;
  versionId?: string;
  publishedAt?: string;
};

export type RunContext = {
  readonly sdk: EmbeddedGameSdk;
  readonly resolvedConfig: ResolvedGameConfig;
  readonly configHash: string;
  readonly versionHash?: string;
  readonly versionId?: string;
  readonly publishedAt?: string;
  readonly mountedAt: string;
  pendingResolvedConfig?: ResolvedGameConfig;
  pendingConfigHash?: string;
  pendingVersionHash?: string;
  hasPendingUpdate: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validateResolvedConfig = (
  value: unknown,
):
  | { ok: true; config: ResolvedGameConfig }
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
    typeof value['configHash'] !== 'string' ||
    value['configHash'].length === 0
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
      if (!Array.isArray(value[key])) {
        errors.push({
          code: 'CONFIG_INVALID',
          domain: 'Root',
          path: key,
          message: `Missing ${key} domain.`,
        });
      }
      return;
    }

    if (!isRecord(value[key])) {
      errors.push({
        code: 'CONFIG_INVALID',
        domain: 'Root',
        path: key,
        message: `Missing ${key} domain.`,
      });
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, config: value as ResolvedGameConfig };
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
): ResolvedGameConfig => {
  if (ctx.pendingResolvedConfig) return ctx.pendingResolvedConfig;
  return ctx.resolvedConfig;
};
