'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  AstroDefenderConfigV1,
  AstroDefenderDefendedAssetV1,
  AstroDefenderEnemyTypeV1,
} from '@playmasters/types';
import styles from './AstroDefenderConfigEditor.module.css';

const REQUIRED_ENEMY_ORDER: AstroDefenderEnemyTypeV1['id'][] = [
  'drone-fighter',
  'bomber',
  'asteroid-swarm',
  'siege-ship',
  'kamikaze-unit',
];

const REQUIRED_DEFENDED_ASSET_TYPES: AstroDefenderDefendedAssetV1['type'][] = [
  'orbital-station',
  'satellite-array',
  'defense-platform',
  'colony-habitat',
];

type ApiSnapshotResponse = {
  ok: true;
  config: AstroDefenderConfigV1;
  hasDraft: boolean;
  draftVersionId?: string;
  updatedAt?: string;
  validation: {
    valid: boolean;
    issues: Array<{ path: string; message: string }>;
  };
};

const defaultEnemy = (
  id: AstroDefenderEnemyTypeV1['id'],
): AstroDefenderEnemyTypeV1 => ({
  id,
  label: id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' '),
  health: 1,
  speed: 1,
  damage: 1,
  spawnWeight: 1,
  scoreValue: 1,
});

const defaultDefendedAsset = (
  type: AstroDefenderDefendedAssetV1['type'],
): AstroDefenderDefendedAssetV1 => ({
  id: `${type}-01`,
  type,
  maxIntegrity: 100,
  failurePenalty: 100,
});

const toNumber = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const validateLocal = (
  config: AstroDefenderConfigV1,
): Array<{ path: string; message: string }> => {
  const issues: Array<{ path: string; message: string }> = [];
  if (!config.metadata.title.trim()) {
    issues.push({ path: 'metadata.title', message: 'Title is required.' });
  }
  if (!config.metadata.shortDescription.trim()) {
    issues.push({
      path: 'metadata.shortDescription',
      message: 'Short description is required.',
    });
  }
  if (!Array.isArray(config.metadata.tags)) {
    issues.push({ path: 'metadata.tags', message: 'Tags must be an array.' });
  }
  return issues;
};

const normalizeConfig = (
  config: AstroDefenderConfigV1,
): AstroDefenderConfigV1 => {
  const enemyById = new Map(
    config.enemyTypes.map((enemy) => [enemy.id, enemy]),
  );
  const normalizedEnemies = REQUIRED_ENEMY_ORDER.map(
    (id) => enemyById.get(id) ?? defaultEnemy(id),
  );

  const assetByType = new Map(
    config.defendedAssets.map((asset) => [asset.type, asset]),
  );
  const normalizedAssets = REQUIRED_DEFENDED_ASSET_TYPES.map(
    (type) => assetByType.get(type) ?? defaultDefendedAsset(type),
  );

  return {
    ...config,
    metadata: {
      ...config.metadata,
      tags: Array.isArray(config.metadata.tags) ? config.metadata.tags : [],
    },
    enemyTypes: normalizedEnemies,
    defendedAssets: normalizedAssets,
  };
};

export default function AstroDefenderConfigEditor() {
  const [config, setConfig] = useState<AstroDefenderConfigV1 | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftVersionId, setDraftVersionId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [changeNotes, setChangeNotes] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          '/api/admin/games/astro-defender/draft/config',
          {
            cache: 'no-store',
          },
        );
        const json = (await res
          .json()
          .catch(() => ({}))) as Partial<ApiSnapshotResponse> & {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(json.error ?? 'Failed to load Astro Defender config');
        }
        if (!json.config) {
          throw new Error('Astro Defender config payload missing.');
        }
        if (cancelled) return;
        setConfig(normalizeConfig(json.config));
        setHasDraft(Boolean(json.hasDraft));
        setDraftVersionId(json.draftVersionId ?? null);
        setUpdatedAt(json.updatedAt ?? null);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const issues = useMemo(() => (config ? validateLocal(config) : []), [config]);
  const hasBlockingIssues = issues.length > 0;

  const setMetadataField = (
    field: 'title' | 'shortDescription' | 'logoUrl' | 'coverUrl',
    value: string,
  ) => {
    setConfig((current) =>
      current
        ? {
            ...current,
            metadata: {
              ...current.metadata,
              [field]: value,
            },
          }
        : current,
    );
  };

  const setNumberField = (
    section: 'playerDefaults' | 'waveConfig' | 'scoring' | 'difficultyScaling',
    field: string,
    value: string,
  ) => {
    setConfig((current) => {
      if (!current) return current;
      const sectionValue = current[section] as Record<string, number>;
      const fallback = sectionValue[field] ?? 0;
      return {
        ...current,
        [section]: {
          ...sectionValue,
          [field]: toNumber(value, fallback),
        },
      } as AstroDefenderConfigV1;
    });
  };

  const setEnemyField = (
    enemyId: AstroDefenderEnemyTypeV1['id'],
    field: keyof AstroDefenderEnemyTypeV1,
    value: string,
  ) => {
    setConfig((current) => {
      if (!current) return current;
      return {
        ...current,
        enemyTypes: current.enemyTypes.map((enemy) => {
          if (enemy.id !== enemyId) return enemy;
          if (field === 'label') {
            return {
              ...enemy,
              label: value,
            };
          }
          const next = { ...enemy } as Record<string, unknown>;
          next[field] = toNumber(value, enemy[field] as number);
          return next as AstroDefenderEnemyTypeV1;
        }),
      };
    });
  };

  const setDefendedAssetField = (
    type: AstroDefenderDefendedAssetV1['type'],
    field: keyof AstroDefenderDefendedAssetV1,
    value: string,
  ) => {
    setConfig((current) => {
      if (!current) return current;
      return {
        ...current,
        defendedAssets: current.defendedAssets.map((asset) => {
          if (asset.type !== type) return asset;
          if (field === 'id') {
            return {
              ...asset,
              id: value,
            };
          }
          const next = { ...asset } as Record<string, unknown>;
          next[field] = toNumber(value, asset[field] as number);
          return next as AstroDefenderDefendedAssetV1;
        }),
      };
    });
  };

  const onSave = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/games/astro-defender/draft/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config,
          changeNotes: changeNotes.trim() || undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        draftVersionId?: string;
        updatedAt?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? 'Failed to save Astro Defender config');
      }
      setHasDraft(true);
      setDraftVersionId(json.draftVersionId ?? null);
      setUpdatedAt(json.updatedAt ?? new Date().toISOString());
      setSavedAt(new Date().toLocaleTimeString());
      setChangeNotes('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.state}>Loading Astro Defender config...</div>;
  }

  if (!config) {
    return (
      <div className={styles.state}>
        <p className={styles.error}>Config unavailable.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Draft Status</h2>
        <p className={styles.meta}>
          {hasDraft
            ? 'Draft saved in admin storage.'
            : 'Using seeded defaults.'}
        </p>
        <p className={styles.meta}>Draft version: {draftVersionId ?? '-'}</p>
        <p className={styles.meta}>
          Last updated: {updatedAt ? new Date(updatedAt).toLocaleString() : '-'}
        </p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Game Metadata</h2>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>Game ID</span>
            <input value={config.metadata.id} disabled />
          </label>
          <label className={styles.field}>
            <span>Title</span>
            <input
              value={config.metadata.title}
              onChange={(event) =>
                setMetadataField('title', event.target.value)
              }
            />
          </label>
          <label className={styles.fieldWide}>
            <span>Short Description</span>
            <input
              value={config.metadata.shortDescription}
              onChange={(event) =>
                setMetadataField('shortDescription', event.target.value)
              }
            />
          </label>
          <label className={styles.fieldWide}>
            <span>Tags (comma separated)</span>
            <input
              value={config.metadata.tags.join(', ')}
              onChange={(event) =>
                setConfig((current) =>
                  current
                    ? {
                        ...current,
                        metadata: {
                          ...current.metadata,
                          tags: event.target.value
                            .split(',')
                            .map((tag) => tag.trim())
                            .filter((tag) => tag.length > 0),
                        },
                      }
                    : current,
                )
              }
            />
          </label>
          <label className={styles.fieldWide}>
            <span>Logo URL</span>
            <input
              value={config.metadata.logoUrl ?? ''}
              onChange={(event) =>
                setMetadataField('logoUrl', event.target.value)
              }
            />
          </label>
          <label className={styles.fieldWide}>
            <span>Cover URL</span>
            <input
              value={config.metadata.coverUrl ?? ''}
              onChange={(event) =>
                setMetadataField('coverUrl', event.target.value)
              }
            />
          </label>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Player Defaults</h2>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>Move Speed</span>
            <input
              type="number"
              step="0.1"
              value={config.playerDefaults.moveSpeed}
              onChange={(event) =>
                setNumberField(
                  'playerDefaults',
                  'moveSpeed',
                  event.target.value,
                )
              }
            />
          </label>
          <label className={styles.field}>
            <span>Boost Speed</span>
            <input
              type="number"
              step="0.1"
              value={config.playerDefaults.boostSpeed}
              onChange={(event) =>
                setNumberField(
                  'playerDefaults',
                  'boostSpeed',
                  event.target.value,
                )
              }
            />
          </label>
          <label className={styles.field}>
            <span>Max Shield</span>
            <input
              type="number"
              value={config.playerDefaults.maxShield}
              onChange={(event) =>
                setNumberField(
                  'playerDefaults',
                  'maxShield',
                  event.target.value,
                )
              }
            />
          </label>
          <label className={styles.field}>
            <span>Fire Rate</span>
            <input
              type="number"
              step="0.1"
              value={config.playerDefaults.fireRate}
              onChange={(event) =>
                setNumberField('playerDefaults', 'fireRate', event.target.value)
              }
            />
          </label>
          <label className={styles.field}>
            <span>Interceptor Agility</span>
            <input
              type="number"
              step="0.1"
              value={config.playerDefaults.interceptorAgility}
              onChange={(event) =>
                setNumberField(
                  'playerDefaults',
                  'interceptorAgility',
                  event.target.value,
                )
              }
            />
          </label>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Wave Configuration</h2>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>Base Threat Budget</span>
            <input
              type="number"
              step="0.1"
              value={config.waveConfig.baseThreatBudget}
              onChange={(event) =>
                setNumberField(
                  'waveConfig',
                  'baseThreatBudget',
                  event.target.value,
                )
              }
            />
          </label>
          <label className={styles.field}>
            <span>Growth Per Wave</span>
            <input
              type="number"
              step="0.1"
              value={config.waveConfig.growthPerWave}
              onChange={(event) =>
                setNumberField(
                  'waveConfig',
                  'growthPerWave',
                  event.target.value,
                )
              }
            />
          </label>
          <label className={styles.field}>
            <span>Asteroid Swarm Chance</span>
            <input
              type="number"
              step="0.01"
              value={config.waveConfig.asteroidSwarmChance}
              onChange={(event) =>
                setNumberField(
                  'waveConfig',
                  'asteroidSwarmChance',
                  event.target.value,
                )
              }
            />
          </label>
          <label className={styles.field}>
            <span>Siege Ship Start Wave</span>
            <input
              type="number"
              value={config.waveConfig.siegeShipStartWave}
              onChange={(event) =>
                setNumberField(
                  'waveConfig',
                  'siegeShipStartWave',
                  event.target.value,
                )
              }
            />
          </label>
          <label className={styles.field}>
            <span>Kamikaze Chance</span>
            <input
              type="number"
              step="0.01"
              value={config.waveConfig.kamikazeChance}
              onChange={(event) =>
                setNumberField(
                  'waveConfig',
                  'kamikazeChance',
                  event.target.value,
                )
              }
            />
          </label>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Enemy Type Definitions</h2>
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>Enemy</span>
            <span>Label</span>
            <span>Health</span>
            <span>Speed</span>
            <span>Damage</span>
            <span>Spawn Weight</span>
            <span>Score</span>
          </div>
          {config.enemyTypes.map((enemy) => (
            <div key={enemy.id} className={styles.tableRow}>
              <span>{enemy.id}</span>
              <input
                value={enemy.label}
                onChange={(event) =>
                  setEnemyField(enemy.id, 'label', event.target.value)
                }
              />
              <input
                type="number"
                value={enemy.health}
                onChange={(event) =>
                  setEnemyField(enemy.id, 'health', event.target.value)
                }
              />
              <input
                type="number"
                step="0.1"
                value={enemy.speed}
                onChange={(event) =>
                  setEnemyField(enemy.id, 'speed', event.target.value)
                }
              />
              <input
                type="number"
                value={enemy.damage}
                onChange={(event) =>
                  setEnemyField(enemy.id, 'damage', event.target.value)
                }
              />
              <input
                type="number"
                value={enemy.spawnWeight}
                onChange={(event) =>
                  setEnemyField(enemy.id, 'spawnWeight', event.target.value)
                }
              />
              <input
                type="number"
                value={enemy.scoreValue}
                onChange={(event) =>
                  setEnemyField(enemy.id, 'scoreValue', event.target.value)
                }
              />
            </div>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Defended Asset Definitions</h2>
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>Type</span>
            <span>Asset ID</span>
            <span>Max Integrity</span>
            <span>Failure Penalty</span>
          </div>
          {config.defendedAssets.map((asset) => (
            <div key={asset.type} className={styles.assetRow}>
              <span>{asset.type}</span>
              <input
                value={asset.id}
                onChange={(event) =>
                  setDefendedAssetField(asset.type, 'id', event.target.value)
                }
              />
              <input
                type="number"
                value={asset.maxIntegrity}
                onChange={(event) =>
                  setDefendedAssetField(
                    asset.type,
                    'maxIntegrity',
                    event.target.value,
                  )
                }
              />
              <input
                type="number"
                value={asset.failurePenalty}
                onChange={(event) =>
                  setDefendedAssetField(
                    asset.type,
                    'failurePenalty',
                    event.target.value,
                  )
                }
              />
            </div>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Scoring Parameters</h2>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>Enemy Destruction</span>
            <input
              type="number"
              value={config.scoring.enemyDestruction}
              onChange={(event) =>
                setNumberField(
                  'scoring',
                  'enemyDestruction',
                  event.target.value,
                )
              }
            />
          </label>
          <label className={styles.field}>
            <span>Interception Bonus</span>
            <input
              type="number"
              value={config.scoring.interceptionBonus}
              onChange={(event) =>
                setNumberField(
                  'scoring',
                  'interceptionBonus',
                  event.target.value,
                )
              }
            />
          </label>
          <label className={styles.field}>
            <span>Perfect Defense Bonus</span>
            <input
              type="number"
              value={config.scoring.perfectDefenseBonus}
              onChange={(event) =>
                setNumberField(
                  'scoring',
                  'perfectDefenseBonus',
                  event.target.value,
                )
              }
            />
          </label>
          <label className={styles.field}>
            <span>Combo Multiplier Step</span>
            <input
              type="number"
              step="0.01"
              value={config.scoring.comboMultiplierStep}
              onChange={(event) =>
                setNumberField(
                  'scoring',
                  'comboMultiplierStep',
                  event.target.value,
                )
              }
            />
          </label>
          <label className={styles.field}>
            <span>Combo Window (ms)</span>
            <input
              type="number"
              value={config.scoring.comboWindowMs}
              onChange={(event) =>
                setNumberField('scoring', 'comboWindowMs', event.target.value)
              }
            />
          </label>
          <label className={styles.field}>
            <span>Max Combo Multiplier</span>
            <input
              type="number"
              step="0.1"
              value={config.scoring.maxComboMultiplier}
              onChange={(event) =>
                setNumberField(
                  'scoring',
                  'maxComboMultiplier',
                  event.target.value,
                )
              }
            />
          </label>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Difficulty Scaling</h2>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>Threat Growth Rate</span>
            <input
              type="number"
              step="0.01"
              value={config.difficultyScaling.threatGrowthRate}
              onChange={(event) =>
                setNumberField(
                  'difficultyScaling',
                  'threatGrowthRate',
                  event.target.value,
                )
              }
            />
          </label>
          <label className={styles.field}>
            <span>Projectile Speed Scale</span>
            <input
              type="number"
              step="0.01"
              value={config.difficultyScaling.projectileSpeedScale}
              onChange={(event) =>
                setNumberField(
                  'difficultyScaling',
                  'projectileSpeedScale',
                  event.target.value,
                )
              }
            />
          </label>
          <label className={styles.field}>
            <span>Enemy Aggression Scale</span>
            <input
              type="number"
              step="0.01"
              value={config.difficultyScaling.enemyAggressionScale}
              onChange={(event) =>
                setNumberField(
                  'difficultyScaling',
                  'enemyAggressionScale',
                  event.target.value,
                )
              }
            />
          </label>
          <label className={styles.field}>
            <span>Run Duration Target (sec)</span>
            <input
              type="number"
              value={config.difficultyScaling.runDurationTargetSec}
              onChange={(event) =>
                setNumberField(
                  'difficultyScaling',
                  'runDurationTargetSec',
                  event.target.value,
                )
              }
            />
          </label>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Save Draft</h2>
        <label className={styles.fieldWide}>
          <span>Change Notes (optional)</span>
          <input
            value={changeNotes}
            onChange={(event) => setChangeNotes(event.target.value)}
            placeholder="Describe this balancing update"
          />
        </label>

        {error ? <p className={styles.error}>Error: {error}</p> : null}
        {savedAt ? <p className={styles.success}>Saved at {savedAt}</p> : null}
        {hasBlockingIssues ? (
          <div className={styles.issueWrap}>
            <p className={styles.error}>
              Validation failed. Resolve issues before saving.
            </p>
            <ul className={styles.issueList}>
              {issues.map((issue, idx) => (
                <li key={`${issue.path}-${idx}`}>
                  <strong>{issue.path}</strong>: {issue.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => void onSave()}
            disabled={saving || hasBlockingIssues}
          >
            {saving ? 'Saving...' : 'Save Astro Defender Draft'}
          </button>
        </div>
      </section>
    </div>
  );
}
