export const ASTRO_DEFENDER_CONFIG_SCHEMA_VERSION = 'astro-defender.config.v1';

export type AstroDefenderEnemyTypeId =
  | 'drone-fighter'
  | 'bomber'
  | 'asteroid-swarm'
  | 'siege-ship'
  | 'kamikaze-unit';

export type AstroDefenderDefendedAssetType =
  | 'orbital-station'
  | 'satellite-array'
  | 'defense-platform'
  | 'colony-habitat';

export type AstroDefenderMetadataV1 = {
  id: 'astro-defender';
  title: string;
  shortDescription: string;
  tags: string[];
  logoUrl?: string;
  coverUrl?: string;
};

export type AstroDefenderPlayerDefaultsV1 = {
  moveSpeed: number;
  boostSpeed: number;
  maxShield: number;
  fireRate: number;
  interceptorAgility: number;
};

export type AstroDefenderWaveConfigV1 = {
  baseThreatBudget: number;
  growthPerWave: number;
  asteroidSwarmChance: number;
  siegeShipStartWave: number;
  kamikazeChance: number;
};

export type AstroDefenderEnemyTypeV1 = {
  id: AstroDefenderEnemyTypeId;
  label: string;
  health: number;
  speed: number;
  damage: number;
  spawnWeight: number;
  scoreValue: number;
};

export type AstroDefenderDefendedAssetV1 = {
  id: string;
  type: AstroDefenderDefendedAssetType;
  maxIntegrity: number;
  failurePenalty: number;
};

export type AstroDefenderScoringV1 = {
  enemyDestruction: number;
  interceptionBonus: number;
  perfectDefenseBonus: number;
  comboMultiplierStep: number;
  comboWindowMs: number;
  maxComboMultiplier: number;
};

export type AstroDefenderDifficultyScalingV1 = {
  threatGrowthRate: number;
  projectileSpeedScale: number;
  enemyAggressionScale: number;
  runDurationTargetSec: number;
};

export type AstroDefenderConfigV1 = {
  schemaVersion: typeof ASTRO_DEFENDER_CONFIG_SCHEMA_VERSION;
  gameId: 'astro-defender';
  metadata: AstroDefenderMetadataV1;
  playerDefaults: AstroDefenderPlayerDefaultsV1;
  waveConfig: AstroDefenderWaveConfigV1;
  enemyTypes: AstroDefenderEnemyTypeV1[];
  defendedAssets: AstroDefenderDefendedAssetV1[];
  scoring: AstroDefenderScoringV1;
  difficultyScaling: AstroDefenderDifficultyScalingV1;
};

export type AstroDefenderValidationIssue = {
  path: string;
  message: string;
};

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

export function validateAstroDefenderConfigV1(
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
  if (candidate.gameId !== 'astro-defender') {
    issues.push({ path: 'gameId', message: "Expected 'astro-defender'." });
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
  } else {
    candidate.enemyTypes.forEach((enemy, idx) => {
      if (!enemy?.id?.trim()) {
        issues.push({
          path: `enemyTypes[${idx}].id`,
          message: 'Enemy id is required.',
        });
      }
      pushIfInvalidNumber(
        issues,
        enemy?.health,
        `enemyTypes[${idx}].health`,
        'Health must be numeric.',
      );
      pushIfInvalidNumber(
        issues,
        enemy?.speed,
        `enemyTypes[${idx}].speed`,
        'Speed must be numeric.',
      );
      pushIfInvalidNumber(
        issues,
        enemy?.damage,
        `enemyTypes[${idx}].damage`,
        'Damage must be numeric.',
      );
      pushIfInvalidNumber(
        issues,
        enemy?.spawnWeight,
        `enemyTypes[${idx}].spawnWeight`,
        'Spawn weight must be numeric.',
      );
      pushIfInvalidNumber(
        issues,
        enemy?.scoreValue,
        `enemyTypes[${idx}].scoreValue`,
        'Score value must be numeric.',
      );
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
  } else {
    candidate.defendedAssets.forEach((asset, idx) => {
      if (!asset?.id?.trim()) {
        issues.push({
          path: `defendedAssets[${idx}].id`,
          message: 'Asset id is required.',
        });
      }
      pushIfInvalidNumber(
        issues,
        asset?.maxIntegrity,
        `defendedAssets[${idx}].maxIntegrity`,
        'Max integrity must be numeric.',
      );
      pushIfInvalidNumber(
        issues,
        asset?.failurePenalty,
        `defendedAssets[${idx}].failurePenalty`,
        'Failure penalty must be numeric.',
      );
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
