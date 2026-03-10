import { randomUUID } from 'crypto';
import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import type { AstroDefenderConfigV1 } from '@playmasters/types';
import { ddbDocClient } from './ddb';

const GAME_ID = 'astro-defender' as const;
const ASTRO_DEFENDER_CONFIG_SCHEMA_VERSION =
  'astro-defender.config.v1' as const;
const DOC_ID = `game#${GAME_ID}#config` as const;
const TABLE_NAME =
  process.env.DDB_TABLE_ASTRO_DEFENDER ??
  process.env.DDB_TABLE_GAME_CORE_ASSETS ??
  'PlaymastersGameAssets';
const PK_ATTR =
  process.env.DDB_PK_NAME_ASTRO_DEFENDER ??
  process.env.DDB_PK_NAME_GAME_CORE_ASSETS ??
  'PK';
const SK_ATTR =
  process.env.DDB_SK_NAME_ASTRO_DEFENDER ??
  process.env.DDB_SK_NAME_GAME_CORE_ASSETS ??
  'SK';
const CONFIG_PK = `GAME#${GAME_ID}#CONFIG#main`;

type Actor = {
  userId: string;
  email?: string;
};

type ConfigDocMeta = {
  entityType: 'AstroDefenderConfigDoc';
  gameId: typeof GAME_ID;
  docId: typeof DOC_ID;
  schemaVersion: typeof ASTRO_DEFENDER_CONFIG_SCHEMA_VERSION;
  currentDraftVersionId?: string;
  currentPublishedVersionId?: string;
  createdAt: string;
  updatedAt: string;
};

type ConfigDocVersion = {
  entityType: 'AstroDefenderConfigDocVersion';
  gameId: typeof GAME_ID;
  docId: typeof DOC_ID;
  versionId: string;
  state: 'Draft' | 'Published';
  config: AstroDefenderConfigV1;
  createdAt: string;
  createdBy: string;
  changeNotes?: string;
};

export type AstroDefenderDraftSnapshot = {
  config: AstroDefenderConfigV1;
  hasDraft: boolean;
  draftVersionId?: string;
  updatedAt?: string;
};

export type AstroDefenderValidationIssue = {
  path: string;
  message: string;
};

const nowIso = () => new Date().toISOString();

const key = (pkValue: string, skValue: string) => ({
  [PK_ATTR]: pkValue,
  [SK_ATTR]: skValue,
});

const versionSk = (versionId: string) => `VERSION#${versionId}`;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const pushIfInvalidNumber = (
  issues: AstroDefenderValidationIssue[],
  value: unknown,
  path: string,
  message: string,
) => {
  if (!isFiniteNumber(value)) {
    issues.push({ path, message });
  }
};

export function validateAstroDefenderConfig(
  config: unknown,
): AstroDefenderValidationIssue[] {
  const issues: AstroDefenderValidationIssue[] = [];
  if (!config || typeof config !== 'object') {
    issues.push({ path: 'config', message: 'Config is required.' });
    return issues;
  }

  const candidate = config as Partial<AstroDefenderConfigV1>;
  if (candidate.schemaVersion !== ASTRO_DEFENDER_CONFIG_SCHEMA_VERSION) {
    issues.push({
      path: 'schemaVersion',
      message: `Expected '${ASTRO_DEFENDER_CONFIG_SCHEMA_VERSION}'.`,
    });
  }
  if (candidate.gameId !== GAME_ID) {
    issues.push({ path: 'gameId', message: `Expected '${GAME_ID}'.` });
  }
  if (!candidate.metadata?.title?.trim()) {
    issues.push({ path: 'metadata.title', message: 'Title is required.' });
  }
  if (!candidate.metadata?.shortDescription?.trim()) {
    issues.push({
      path: 'metadata.shortDescription',
      message: 'Short description is required.',
    });
  }
  if (!Array.isArray(candidate.metadata?.tags)) {
    issues.push({ path: 'metadata.tags', message: 'Tags must be an array.' });
  }

  pushIfInvalidNumber(
    issues,
    candidate.playerDefaults?.moveSpeed,
    'playerDefaults.moveSpeed',
    'Move speed must be numeric.',
  );
  pushIfInvalidNumber(
    issues,
    candidate.playerDefaults?.boostSpeed,
    'playerDefaults.boostSpeed',
    'Boost speed must be numeric.',
  );
  pushIfInvalidNumber(
    issues,
    candidate.playerDefaults?.maxShield,
    'playerDefaults.maxShield',
    'Max shield must be numeric.',
  );
  pushIfInvalidNumber(
    issues,
    candidate.playerDefaults?.fireRate,
    'playerDefaults.fireRate',
    'Fire rate must be numeric.',
  );
  pushIfInvalidNumber(
    issues,
    candidate.playerDefaults?.interceptorAgility,
    'playerDefaults.interceptorAgility',
    'Interceptor agility must be numeric.',
  );

  pushIfInvalidNumber(
    issues,
    candidate.waveConfig?.baseThreatBudget,
    'waveConfig.baseThreatBudget',
    'Base threat budget must be numeric.',
  );
  pushIfInvalidNumber(
    issues,
    candidate.waveConfig?.growthPerWave,
    'waveConfig.growthPerWave',
    'Growth per wave must be numeric.',
  );
  pushIfInvalidNumber(
    issues,
    candidate.waveConfig?.asteroidSwarmChance,
    'waveConfig.asteroidSwarmChance',
    'Asteroid swarm chance must be numeric.',
  );
  pushIfInvalidNumber(
    issues,
    candidate.waveConfig?.siegeShipStartWave,
    'waveConfig.siegeShipStartWave',
    'Siege ship start wave must be numeric.',
  );
  pushIfInvalidNumber(
    issues,
    candidate.waveConfig?.kamikazeChance,
    'waveConfig.kamikazeChance',
    'Kamikaze chance must be numeric.',
  );

  if (!Array.isArray(candidate.enemyTypes) || candidate.enemyTypes.length < 1) {
    issues.push({
      path: 'enemyTypes',
      message: 'At least one enemy type is required.',
    });
  }
  if (
    !Array.isArray(candidate.defendedAssets) ||
    candidate.defendedAssets.length < 1
  ) {
    issues.push({
      path: 'defendedAssets',
      message: 'At least one defended asset is required.',
    });
  }

  pushIfInvalidNumber(
    issues,
    candidate.scoring?.enemyDestruction,
    'scoring.enemyDestruction',
    'Enemy destruction score must be numeric.',
  );
  pushIfInvalidNumber(
    issues,
    candidate.scoring?.interceptionBonus,
    'scoring.interceptionBonus',
    'Interception bonus must be numeric.',
  );
  pushIfInvalidNumber(
    issues,
    candidate.scoring?.perfectDefenseBonus,
    'scoring.perfectDefenseBonus',
    'Perfect defense bonus must be numeric.',
  );
  pushIfInvalidNumber(
    issues,
    candidate.scoring?.comboMultiplierStep,
    'scoring.comboMultiplierStep',
    'Combo multiplier step must be numeric.',
  );
  pushIfInvalidNumber(
    issues,
    candidate.scoring?.comboWindowMs,
    'scoring.comboWindowMs',
    'Combo window must be numeric.',
  );
  pushIfInvalidNumber(
    issues,
    candidate.scoring?.maxComboMultiplier,
    'scoring.maxComboMultiplier',
    'Max combo multiplier must be numeric.',
  );

  pushIfInvalidNumber(
    issues,
    candidate.difficultyScaling?.threatGrowthRate,
    'difficultyScaling.threatGrowthRate',
    'Threat growth rate must be numeric.',
  );
  pushIfInvalidNumber(
    issues,
    candidate.difficultyScaling?.projectileSpeedScale,
    'difficultyScaling.projectileSpeedScale',
    'Projectile speed scale must be numeric.',
  );
  pushIfInvalidNumber(
    issues,
    candidate.difficultyScaling?.enemyAggressionScale,
    'difficultyScaling.enemyAggressionScale',
    'Enemy aggression scale must be numeric.',
  );
  pushIfInvalidNumber(
    issues,
    candidate.difficultyScaling?.runDurationTargetSec,
    'difficultyScaling.runDurationTargetSec',
    'Run duration target must be numeric.',
  );

  return issues;
}

export const createDefaultAstroDefenderConfig = (): AstroDefenderConfigV1 => ({
  schemaVersion: ASTRO_DEFENDER_CONFIG_SCHEMA_VERSION,
  gameId: GAME_ID,
  metadata: {
    id: GAME_ID,
    title: 'Astro Defender',
    shortDescription:
      'Defend orbital infrastructure from alien fleets and asteroid swarms.',
    tags: ['arcade', 'defense', 'score-attack'],
    logoUrl: '',
    coverUrl: '',
  },
  playerDefaults: {
    moveSpeed: 8.5,
    boostSpeed: 13.5,
    maxShield: 100,
    fireRate: 7.5,
    interceptorAgility: 9,
  },
  waveConfig: {
    baseThreatBudget: 16,
    growthPerWave: 3.2,
    asteroidSwarmChance: 0.18,
    siegeShipStartWave: 6,
    kamikazeChance: 0.12,
  },
  enemyTypes: [
    {
      id: 'drone-fighter',
      label: 'Drone Fighter',
      health: 28,
      speed: 7.4,
      damage: 8,
      spawnWeight: 36,
      scoreValue: 120,
    },
    {
      id: 'bomber',
      label: 'Bomber',
      health: 65,
      speed: 4.8,
      damage: 20,
      spawnWeight: 18,
      scoreValue: 260,
    },
    {
      id: 'asteroid-swarm',
      label: 'Asteroid Swarm',
      health: 18,
      speed: 6.4,
      damage: 12,
      spawnWeight: 22,
      scoreValue: 95,
    },
    {
      id: 'siege-ship',
      label: 'Siege Ship',
      health: 220,
      speed: 2.4,
      damage: 45,
      spawnWeight: 6,
      scoreValue: 900,
    },
    {
      id: 'kamikaze-unit',
      label: 'Kamikaze Unit',
      health: 20,
      speed: 9.2,
      damage: 25,
      spawnWeight: 12,
      scoreValue: 180,
    },
  ],
  defendedAssets: [
    {
      id: 'orbital-station-prime',
      type: 'orbital-station',
      maxIntegrity: 1000,
      failurePenalty: 1800,
    },
    {
      id: 'satellite-array-alpha',
      type: 'satellite-array',
      maxIntegrity: 540,
      failurePenalty: 900,
    },
    {
      id: 'defense-platform-kappa',
      type: 'defense-platform',
      maxIntegrity: 640,
      failurePenalty: 1100,
    },
    {
      id: 'colony-habitat-delta',
      type: 'colony-habitat',
      maxIntegrity: 720,
      failurePenalty: 1300,
    },
  ],
  scoring: {
    enemyDestruction: 100,
    interceptionBonus: 30,
    perfectDefenseBonus: 2000,
    comboMultiplierStep: 0.1,
    comboWindowMs: 2200,
    maxComboMultiplier: 3.5,
  },
  difficultyScaling: {
    threatGrowthRate: 1.12,
    projectileSpeedScale: 1.06,
    enemyAggressionScale: 1.08,
    runDurationTargetSec: 210,
  },
});

const parseConfigVersion = (
  item: Record<string, unknown>,
): ConfigDocVersion => {
  const { [PK_ATTR]: _pk, [SK_ATTR]: _sk, ...rest } = item;
  void _pk;
  void _sk;
  return rest as ConfigDocVersion;
};

const parseConfigMeta = (item: Record<string, unknown>): ConfigDocMeta => {
  const { [PK_ATTR]: _pk, [SK_ATTR]: _sk, ...rest } = item;
  void _pk;
  void _sk;
  return rest as ConfigDocMeta;
};

export async function getAstroDefenderDraftSnapshot(): Promise<AstroDefenderDraftSnapshot> {
  const metaRes = await ddbDocClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: key(CONFIG_PK, 'META'),
    }),
  );
  if (!metaRes.Item) {
    return {
      config: createDefaultAstroDefenderConfig(),
      hasDraft: false,
    };
  }

  const meta = parseConfigMeta(metaRes.Item);
  if (!meta.currentDraftVersionId) {
    return {
      config: createDefaultAstroDefenderConfig(),
      hasDraft: false,
      updatedAt: meta.updatedAt,
    };
  }

  const versionRes = await ddbDocClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: key(CONFIG_PK, versionSk(meta.currentDraftVersionId)),
    }),
  );
  if (!versionRes.Item) {
    return {
      config: createDefaultAstroDefenderConfig(),
      hasDraft: false,
      updatedAt: meta.updatedAt,
    };
  }

  const version = parseConfigVersion(versionRes.Item);
  return {
    config: version.config,
    hasDraft: true,
    draftVersionId: version.versionId,
    updatedAt: meta.updatedAt,
  };
}

export async function saveAstroDefenderDraftConfig(args: {
  config: AstroDefenderConfigV1;
  actor: Actor;
  changeNotes?: string;
}): Promise<{ draftVersionId: string; updatedAt: string }> {
  const issues = validateAstroDefenderConfig(args.config);
  if (issues.length > 0) {
    const err = new Error('validation_failed');
    (err as Error & { details?: unknown }).details = issues;
    throw err;
  }

  const now = nowIso();
  const draftVersionId = randomUUID();
  const currentMetaRes = await ddbDocClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: key(CONFIG_PK, 'META'),
    }),
  );
  const currentMeta = currentMetaRes.Item
    ? parseConfigMeta(currentMetaRes.Item)
    : null;

  const nextMeta: ConfigDocMeta = {
    entityType: 'AstroDefenderConfigDoc',
    gameId: GAME_ID,
    docId: DOC_ID,
    schemaVersion: ASTRO_DEFENDER_CONFIG_SCHEMA_VERSION,
    currentDraftVersionId: draftVersionId,
    currentPublishedVersionId: currentMeta?.currentPublishedVersionId,
    createdAt: currentMeta?.createdAt ?? now,
    updatedAt: now,
  };

  const versionRecord: ConfigDocVersion = {
    entityType: 'AstroDefenderConfigDocVersion',
    gameId: GAME_ID,
    docId: DOC_ID,
    versionId: draftVersionId,
    state: 'Draft',
    config: args.config,
    createdAt: now,
    createdBy: args.actor.userId,
    changeNotes: args.changeNotes?.trim() || undefined,
  };

  await ddbDocClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              ...key(CONFIG_PK, 'META'),
              ...nextMeta,
            },
          },
        },
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              ...key(CONFIG_PK, versionSk(draftVersionId)),
              ...versionRecord,
            },
          },
        },
      ],
    }),
  );

  return {
    draftVersionId,
    updatedAt: now,
  };
}
