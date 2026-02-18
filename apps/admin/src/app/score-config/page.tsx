'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './page.module.css';
import {
  type ValidationIssue,
  validateScoreConfigDraft,
} from './validateScoreConfigDraft';

type Enemy = { enemyId: string; displayName?: string };

type BaseEnemyScore = { enemyId: string; score: number };
type AccuracyThreshold = {
  minAccuracy: number;
  bonus: number;
  uiId?: string;
};
type ComboTier = {
  minCount: number;
  multiplier: number;
  tierBonus?: number;
  name?: string;
  uiId?: string;
};

type ScoreConfig = {
  scoreConfigId: string;
  baseEnemyScores: BaseEnemyScore[];
  levelScoreMultiplier?: {
    base: number;
    perLevel: number;
    max: number;
  };
  combo?: {
    enabled: boolean;
    tiers: ComboTier[];
    minWindowMs?: number;
    windowMs?: number;
    resetOnPlayerHit?: boolean;
    windowDecayPerLevelMs?: number;
  };
  waveClearBonus?: {
    base: number;
    perLifeBonus: number;
  };
  accuracyBonus?: {
    scaleByLevelMultiplier?: boolean;
    thresholds: AccuracyThreshold[];
  };
  updatedAt?: string;
};

const DEFAULT_LEVEL_SCORE_MULTIPLIER = {
  base: 1,
  perLevel: 0,
  max: 1,
};
const DEFAULT_WAVE_CLEAR_BONUS = {
  base: 0,
  perLifeBonus: 0,
};
const DEFAULT_COMBO_CONFIG = {
  enabled: false,
  tiers: [] as ComboTier[],
};
const DEFAULT_ACCURACY_BONUS = {
  scaleByLevelMultiplier: false,
  thresholds: [] as AccuracyThreshold[],
};

const DEFAULT_SCORE_CONFIG: ScoreConfig = {
  scoreConfigId: 'default',
  baseEnemyScores: [],
  levelScoreMultiplier: DEFAULT_LEVEL_SCORE_MULTIPLIER,
  waveClearBonus: DEFAULT_WAVE_CLEAR_BONUS,
  combo: DEFAULT_COMBO_CONFIG,
  accuracyBonus: DEFAULT_ACCURACY_BONUS,
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const computeLevelMultiplierPreview = (params: {
  levelNumber: number;
  base: number;
  perLevel: number;
  max: number;
}): number => {
  const level = Math.max(1, Math.floor(params.levelNumber));
  const raw = params.base + params.perLevel * (level - 1);
  return clamp(raw, 0, params.max);
};

export default function ScoreConfigPage() {
  const comboRowIdRef = useRef(0);
  const accuracyRowIdRef = useRef(0);
  const [config, setConfig] = useState<ScoreConfig>(DEFAULT_SCORE_CONFIG);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [wavePerLifeEnabled, setWavePerLifeEnabled] = useState(false);

  const createComboRowId = (): string => {
    comboRowIdRef.current += 1;
    return `combo-tier-${comboRowIdRef.current}`;
  };

  const createAccuracyRowId = (): string => {
    accuracyRowIdRef.current += 1;
    return `accuracy-threshold-${accuracyRowIdRef.current}`;
  };

  const withEditorDefaults = (next: ScoreConfig): ScoreConfig => ({
    ...next,
    levelScoreMultiplier:
      next.levelScoreMultiplier ?? DEFAULT_LEVEL_SCORE_MULTIPLIER,
    waveClearBonus: next.waveClearBonus ?? DEFAULT_WAVE_CLEAR_BONUS,
    accuracyBonus: {
      ...(next.accuracyBonus ?? DEFAULT_ACCURACY_BONUS),
      thresholds: (next.accuracyBonus?.thresholds ?? []).map((threshold) => ({
        ...threshold,
        uiId: threshold.uiId ?? createAccuracyRowId(),
      })),
    },
    combo: {
      ...(next.combo ?? DEFAULT_COMBO_CONFIG),
      tiers: (next.combo?.tiers ?? []).map((tier, idx) => ({
        ...tier,
        name: tier.name ?? `tier-${idx + 1}`,
        uiId: tier.uiId ?? createComboRowId(),
      })),
    },
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const [cfgRes, enemyRes] = await Promise.all([
          fetch('/api/score-config'),
          fetch('/api/catalog/enemies'),
        ]);
        if (!cfgRes.ok) throw new Error('Failed to load score config');
        if (!enemyRes.ok) throw new Error('Failed to load enemies');

        const cfgJson = await cfgRes.json();
        const enemyJson = await enemyRes.json();
        if (cancelled) return;

        const nextConfig = withEditorDefaults(
          cfgJson.config ?? DEFAULT_SCORE_CONFIG,
        );
        setConfig(nextConfig);
        setWavePerLifeEnabled(
          (nextConfig.waveClearBonus?.perLifeBonus ?? 0) > 0,
        );
        setEnemies(Array.isArray(enemyJson.enemies) ? enemyJson.enemies : []);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Load failed');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const scoreByEnemyId = useMemo(() => {
    const map = new Map<string, number>();
    (config.baseEnemyScores ?? []).forEach((row) => {
      map.set(row.enemyId, row.score);
    });
    return map;
  }, [config.baseEnemyScores]);

  const publishedEnemyIds = useMemo(
    () => new Set(enemies.map((enemy) => enemy.enemyId)),
    [enemies],
  );

  const unknownBaseScoreRows = useMemo(
    () =>
      (config.baseEnemyScores ?? []).filter(
        (row) => !publishedEnemyIds.has(row.enemyId),
      ),
    [config.baseEnemyScores, publishedEnemyIds],
  );

  const issues = useMemo(
    () =>
      validateScoreConfigDraft(
        {
          baseEnemyScores: config.baseEnemyScores ?? [],
          levelScoreMultiplier: config.levelScoreMultiplier,
          waveClearBonus: config.waveClearBonus,
          combo: config.combo,
          accuracyBonus: config.accuracyBonus,
        },
        { enemies },
      ),
    [
      config.baseEnemyScores,
      config.combo,
      config.levelScoreMultiplier,
      config.waveClearBonus,
      config.accuracyBonus,
      enemies,
    ],
  );

  const hasBlocking = issues.some((issue) => issue.severity === 'error');

  const getIssueForEnemy = (enemyId: string): ValidationIssue | undefined =>
    issues.find(
      (issue) =>
        issue.path === `baseEnemyScores[${enemyId}]` ||
        issue.path === `baseEnemyScores[${enemyId}].score`,
    );

  const getIssueForPath = (path: string): ValidationIssue | undefined =>
    issues.find((issue) => issue.path === path);

  const comboTiers = config.combo?.tiers ?? [];
  const comboTierIssues = issues.filter((issue) =>
    issue.path.startsWith('combo.tiers['),
  );
  const accuracyThresholds = config.accuracyBonus?.thresholds ?? [];
  const accuracyThresholdIssues = issues.filter((issue) =>
    issue.path.startsWith('accuracyBonus.thresholds['),
  );

  const getIssueForTierPath = (
    tierIndex: number,
    field: 'minCount' | 'multiplier' | 'tierBonus',
  ): ValidationIssue | undefined =>
    getIssueForPath(`combo.tiers[${tierIndex}].${field}`);

  const getIssueForAccuracyPath = (
    thresholdIndex: number,
    field: 'minAccuracy' | 'bonus',
  ): ValidationIssue | undefined =>
    getIssueForPath(`accuracyBonus.thresholds[${thresholdIndex}].${field}`);

  const setEnemyScore = (enemyId: string, value: string) => {
    setConfig((current) => {
      const rows = [...(current.baseEnemyScores ?? [])];
      const rowIdx = rows.findIndex((row) => row.enemyId === enemyId);

      if (value.trim() === '') {
        if (rowIdx >= 0) {
          rows.splice(rowIdx, 1);
        }
        return { ...current, baseEnemyScores: rows };
      }

      const nextScore = Number(value);
      if (rowIdx >= 0) {
        rows[rowIdx] = { enemyId, score: nextScore };
      } else {
        rows.push({ enemyId, score: nextScore });
      }
      return { ...current, baseEnemyScores: rows };
    });
  };

  const addMissingEnemyRows = () => {
    setConfig((current) => {
      const rows = [...(current.baseEnemyScores ?? [])];
      const existing = new Set(rows.map((row) => row.enemyId));

      enemies.forEach((enemy) => {
        if (!existing.has(enemy.enemyId)) {
          rows.push({ enemyId: enemy.enemyId, score: 0 });
        }
      });

      return { ...current, baseEnemyScores: rows };
    });
  };

  const setLevelMultiplierField = (
    field: 'base' | 'perLevel' | 'max',
    value: string,
  ) => {
    setConfig((current) => ({
      ...current,
      levelScoreMultiplier: {
        ...(current.levelScoreMultiplier ?? DEFAULT_LEVEL_SCORE_MULTIPLIER),
        [field]: value.trim() === '' ? Number.NaN : Number(value),
      },
    }));
  };

  const setWaveBonusField = (field: 'base' | 'perLifeBonus', value: string) => {
    setConfig((current) => ({
      ...current,
      waveClearBonus: {
        ...(current.waveClearBonus ?? DEFAULT_WAVE_CLEAR_BONUS),
        [field]: value.trim() === '' ? Number.NaN : Number(value),
      },
    }));
  };

  const toggleWavePerLife = (enabled: boolean) => {
    setWavePerLifeEnabled(enabled);
    if (!enabled) {
      setConfig((current) => ({
        ...current,
        waveClearBonus: {
          ...(current.waveClearBonus ?? DEFAULT_WAVE_CLEAR_BONUS),
          perLifeBonus: 0,
        },
      }));
    }
  };

  const updateComboTierField = (
    tierUiId: string,
    field: 'minCount' | 'multiplier' | 'tierBonus',
    value: string,
  ) => {
    setConfig((current) => ({
      ...current,
      combo: {
        ...(current.combo ?? DEFAULT_COMBO_CONFIG),
        tiers: (current.combo?.tiers ?? []).map((tier) => {
          if (tier.uiId !== tierUiId) return tier;
          return {
            ...tier,
            [field]: value.trim() === '' ? Number.NaN : Number(value),
          };
        }),
      },
    }));
  };

  const addComboTier = () => {
    setConfig((current) => {
      const tiers = [...(current.combo?.tiers ?? [])];
      const lastMinCount =
        tiers.length > 0 && Number.isFinite(tiers[tiers.length - 1].minCount)
          ? tiers[tiers.length - 1].minCount
          : 0;
      tiers.push({
        uiId: createComboRowId(),
        name: `tier-${tiers.length + 1}`,
        minCount: Math.max(1, Math.floor(lastMinCount) + 1),
        multiplier: 1,
        tierBonus: 0,
      });
      return {
        ...current,
        combo: {
          ...(current.combo ?? DEFAULT_COMBO_CONFIG),
          tiers,
        },
      };
    });
  };

  const removeComboTier = (tierUiId: string) => {
    setConfig((current) => ({
      ...current,
      combo: {
        ...(current.combo ?? DEFAULT_COMBO_CONFIG),
        tiers: (current.combo?.tiers ?? []).filter(
          (tier) => tier.uiId !== tierUiId,
        ),
      },
    }));
  };

  const moveComboTier = (tierUiId: string, direction: 'up' | 'down') => {
    setConfig((current) => {
      const tiers = [...(current.combo?.tiers ?? [])];
      const from = tiers.findIndex((tier) => tier.uiId === tierUiId);
      if (from < 0) return current;
      const to = direction === 'up' ? from - 1 : from + 1;
      if (to < 0 || to >= tiers.length) return current;
      const [moved] = tiers.splice(from, 1);
      tiers.splice(to, 0, moved);
      return {
        ...current,
        combo: {
          ...(current.combo ?? DEFAULT_COMBO_CONFIG),
          tiers,
        },
      };
    });
  };

  const updateAccuracyThresholdField = (
    thresholdUiId: string,
    field: 'minAccuracy' | 'bonus',
    value: string,
  ) => {
    setConfig((current) => ({
      ...current,
      accuracyBonus: {
        ...(current.accuracyBonus ?? DEFAULT_ACCURACY_BONUS),
        thresholds: (current.accuracyBonus?.thresholds ?? []).map(
          (threshold) => {
            if (threshold.uiId !== thresholdUiId) return threshold;
            return {
              ...threshold,
              [field]: value.trim() === '' ? Number.NaN : Number(value),
            };
          },
        ),
      },
    }));
  };

  const addAccuracyThreshold = () => {
    setConfig((current) => {
      const thresholds = [...(current.accuracyBonus?.thresholds ?? [])];
      const lastMinAccuracy =
        thresholds.length > 0 &&
        Number.isFinite(thresholds[thresholds.length - 1].minAccuracy)
          ? thresholds[thresholds.length - 1].minAccuracy
          : 0;
      thresholds.push({
        uiId: createAccuracyRowId(),
        minAccuracy: Number(Math.min(lastMinAccuracy + 0.1, 1).toFixed(2)),
        bonus: 0,
      });
      return {
        ...current,
        accuracyBonus: {
          ...(current.accuracyBonus ?? DEFAULT_ACCURACY_BONUS),
          thresholds,
        },
      };
    });
  };

  const removeAccuracyThreshold = (thresholdUiId: string) => {
    setConfig((current) => ({
      ...current,
      accuracyBonus: {
        ...(current.accuracyBonus ?? DEFAULT_ACCURACY_BONUS),
        thresholds: (current.accuracyBonus?.thresholds ?? []).filter(
          (threshold) => threshold.uiId !== thresholdUiId,
        ),
      },
    }));
  };

  const moveAccuracyThreshold = (
    thresholdUiId: string,
    direction: 'up' | 'down',
  ) => {
    setConfig((current) => {
      const thresholds = [...(current.accuracyBonus?.thresholds ?? [])];
      const from = thresholds.findIndex(
        (threshold) => threshold.uiId === thresholdUiId,
      );
      if (from < 0) return current;
      const to = direction === 'up' ? from - 1 : from + 1;
      if (to < 0 || to >= thresholds.length) return current;
      const [moved] = thresholds.splice(from, 1);
      thresholds.splice(to, 0, moved);
      return {
        ...current,
        accuracyBonus: {
          ...(current.accuracyBonus ?? DEFAULT_ACCURACY_BONUS),
          thresholds,
        },
      };
    });
  };

  const multiplierPreviews = useMemo(() => {
    const multiplier =
      config.levelScoreMultiplier ?? DEFAULT_LEVEL_SCORE_MULTIPLIER;
    if (
      !Number.isFinite(multiplier.base) ||
      !Number.isFinite(multiplier.perLevel) ||
      !Number.isFinite(multiplier.max)
    ) {
      return null;
    }
    return [1, 5, 10].map((level) => ({
      level,
      value: computeLevelMultiplierPreview({
        levelNumber: level,
        base: multiplier.base,
        perLevel: multiplier.perLevel,
        max: multiplier.max,
      }),
    }));
  }, [config.levelScoreMultiplier]);

  const sortBaseEnemyScores = (
    rows: BaseEnemyScore[],
    catalogOrder: Enemy[],
  ): BaseEnemyScore[] => {
    const indexById = new Map(
      catalogOrder.map((enemy, idx) => [enemy.enemyId, idx]),
    );
    return [...rows].sort((a, b) => {
      const aIdx = indexById.get(a.enemyId);
      const bIdx = indexById.get(b.enemyId);
      if (typeof aIdx === 'number' && typeof bIdx === 'number')
        return aIdx - bIdx;
      if (typeof aIdx === 'number') return -1;
      if (typeof bIdx === 'number') return 1;
      return a.enemyId.localeCompare(b.enemyId);
    });
  };

  async function onSaveDraft() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/score-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          baseEnemyScores: sortBaseEnemyScores(
            config.baseEnemyScores ?? [],
            enemies,
          ),
          combo: config.combo
            ? {
                ...config.combo,
                tiers: (config.combo.tiers ?? []).map(({ uiId, ...tier }) => {
                  void uiId;
                  return tier;
                }),
              }
            : undefined,
          accuracyBonus: config.accuracyBonus
            ? {
                ...config.accuracyBonus,
                thresholds: (config.accuracyBonus.thresholds ?? []).map(
                  ({ uiId, ...threshold }) => {
                    void uiId;
                    return threshold;
                  },
                ),
              }
            : undefined,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Save failed');
      }

      const payload = await res.json();
      const nextConfig = withEditorDefaults(
        payload.config ?? DEFAULT_SCORE_CONFIG,
      );
      setConfig(nextConfig);
      setWavePerLifeEnabled((nextConfig.waveClearBonus?.perLifeBonus ?? 0) > 0);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Score Config</h1>
          <div className={styles.meta}>Base enemy score editor</div>
        </div>
        <button
          className={styles.saveBtn}
          type="button"
          onClick={() => {
            void onSaveDraft();
          }}
          disabled={saving || loading}
        >
          {saving ? 'Saving...' : 'Save Draft'}
        </button>
      </header>

      {error && <div className={styles.error}>Error: {error}</div>}
      {savedAt && <div className={styles.success}>Saved at {savedAt}</div>}

      <section className={styles.card}>
        <h2>Publish Readiness</h2>
        {issues.length === 0 ? (
          <div className={styles.success}>Ready to publish</div>
        ) : (
          <>
            <div className={styles.error}>
              Not ready:{' '}
              {issues.filter((issue) => issue.severity === 'error').length}{' '}
              blocking issue(s)
            </div>
            <ul className={styles.issueList}>
              {issues.map((issue, idx) => (
                <li key={`${issue.path}-${idx}`}>
                  <strong>{issue.path}</strong>: {issue.message}
                </li>
              ))}
            </ul>
          </>
        )}
        {hasBlocking && (
          <div className={styles.helper}>
            Publish is blocked until blocking issues are resolved.
          </div>
        )}
      </section>

      <section className={styles.card}>
        <h2>Level Multiplier</h2>
        <div className={styles.helper}>
          Runtime preview uses ScoreSystem formula: clamp(base + perLevel *
          (level - 1), 0, max).
        </div>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Base</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              step={0.01}
              value={
                Number.isFinite(config.levelScoreMultiplier?.base)
                  ? config.levelScoreMultiplier?.base
                  : ''
              }
              onChange={(event) =>
                setLevelMultiplierField('base', event.target.value)
              }
            />
            {getIssueForPath('levelScoreMultiplier.base') && (
              <div className={styles.errorInline}>
                {getIssueForPath('levelScoreMultiplier.base')?.message}
              </div>
            )}
          </label>

          <label className={styles.field}>
            <span>Per Level</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              step={0.01}
              value={
                Number.isFinite(config.levelScoreMultiplier?.perLevel)
                  ? config.levelScoreMultiplier?.perLevel
                  : ''
              }
              onChange={(event) =>
                setLevelMultiplierField('perLevel', event.target.value)
              }
            />
            {getIssueForPath('levelScoreMultiplier.perLevel') && (
              <div className={styles.errorInline}>
                {getIssueForPath('levelScoreMultiplier.perLevel')?.message}
              </div>
            )}
          </label>

          <label className={styles.field}>
            <span>Max</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              step={0.01}
              value={
                Number.isFinite(config.levelScoreMultiplier?.max)
                  ? config.levelScoreMultiplier?.max
                  : ''
              }
              onChange={(event) =>
                setLevelMultiplierField('max', event.target.value)
              }
            />
            {getIssueForPath('levelScoreMultiplier.max') && (
              <div className={styles.errorInline}>
                {getIssueForPath('levelScoreMultiplier.max')?.message}
              </div>
            )}
          </label>
        </div>

        {multiplierPreviews && (
          <div className={styles.exampleBox}>
            <strong>Examples (Preview)</strong>
            <div className={styles.exampleList}>
              {multiplierPreviews.map((row) => (
                <span key={row.level}>
                  L{row.level}: {row.value.toFixed(2)}x
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h2>Combo Tiers</h2>
          <button
            className={styles.secondaryBtn}
            type="button"
            onClick={addComboTier}
            disabled={loading || saving}
          >
            Add tier
          </button>
        </div>
        <div className={styles.helper}>
          Tiers must be strictly increasing by minCount, unique, multiplier must
          be &gt;= 1, and tier bonus must be &gt;= 0.
        </div>
        {comboTierIssues.length > 0 && (
          <div className={styles.error}>
            Combo tier errors: {comboTierIssues.length}
          </div>
        )}
        <div className={styles.table}>
          <div className={styles.comboHeader}>
            <span>Name</span>
            <span>minCount</span>
            <span>Multiplier</span>
            <span>Tier Bonus</span>
            <span>Actions</span>
          </div>
          {comboTiers.map((tier, idx) => (
            <div
              key={tier.uiId ?? tier.name ?? `combo-${idx}`}
              className={styles.comboRow}
            >
              <span>
                <strong>{tier.name ?? `tier-${idx + 1}`}</strong>
              </span>
              <div>
                <input
                  className={styles.input}
                  type="number"
                  step={1}
                  min={1}
                  value={Number.isFinite(tier.minCount) ? tier.minCount : ''}
                  onChange={(event) =>
                    updateComboTierField(
                      tier.uiId ?? '',
                      'minCount',
                      event.target.value,
                    )
                  }
                />
                {getIssueForTierPath(idx, 'minCount') && (
                  <div className={styles.errorInline}>
                    {getIssueForTierPath(idx, 'minCount')?.message}
                  </div>
                )}
              </div>
              <div>
                <input
                  className={styles.input}
                  type="number"
                  step={0.01}
                  min={1}
                  value={
                    Number.isFinite(tier.multiplier) ? tier.multiplier : ''
                  }
                  onChange={(event) =>
                    updateComboTierField(
                      tier.uiId ?? '',
                      'multiplier',
                      event.target.value,
                    )
                  }
                />
                {getIssueForTierPath(idx, 'multiplier') && (
                  <div className={styles.errorInline}>
                    {getIssueForTierPath(idx, 'multiplier')?.message}
                  </div>
                )}
              </div>
              <div>
                <input
                  className={styles.input}
                  type="number"
                  step={1}
                  min={0}
                  value={Number.isFinite(tier.tierBonus) ? tier.tierBonus : ''}
                  onChange={(event) =>
                    updateComboTierField(
                      tier.uiId ?? '',
                      'tierBonus',
                      event.target.value,
                    )
                  }
                />
                {getIssueForTierPath(idx, 'tierBonus') && (
                  <div className={styles.errorInline}>
                    {getIssueForTierPath(idx, 'tierBonus')?.message}
                  </div>
                )}
              </div>
              <div className={styles.comboActions}>
                <button
                  className={styles.secondaryBtn}
                  type="button"
                  onClick={() => moveComboTier(tier.uiId ?? '', 'up')}
                  disabled={idx === 0 || saving}
                >
                  Up
                </button>
                <button
                  className={styles.secondaryBtn}
                  type="button"
                  onClick={() => moveComboTier(tier.uiId ?? '', 'down')}
                  disabled={idx === comboTiers.length - 1 || saving}
                >
                  Down
                </button>
                <button
                  className={styles.secondaryBtn}
                  type="button"
                  onClick={() => removeComboTier(tier.uiId ?? '')}
                  disabled={saving}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {comboTiers.length === 0 && (
            <div className={styles.helper}>No tiers configured.</div>
          )}
        </div>
      </section>

      <section className={styles.card}>
        <h2>Wave Bonus</h2>
        <div className={styles.helper}>
          Disabled per-life bonus is stored as{' '}
          <code>waveClearBonus.perLifeBonus = 0</code>. Runtime applies:
          round(base * levelMultiplier) + round(perLifeBonus * livesRemaining *
          levelMultiplier).
        </div>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Base</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              step={1}
              value={
                Number.isFinite(config.waveClearBonus?.base)
                  ? config.waveClearBonus?.base
                  : ''
              }
              onChange={(event) =>
                setWaveBonusField('base', event.target.value)
              }
            />
            {getIssueForPath('waveClearBonus.base') && (
              <div className={styles.errorInline}>
                {getIssueForPath('waveClearBonus.base')?.message}
              </div>
            )}
          </label>

          <label className={styles.field}>
            <span>Per-life bonus enabled</span>
            <input
              type="checkbox"
              checked={wavePerLifeEnabled}
              onChange={(event) => toggleWavePerLife(event.target.checked)}
            />
          </label>

          <label className={styles.field}>
            <span>Per-life bonus</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              step={1}
              disabled={!wavePerLifeEnabled}
              value={
                Number.isFinite(config.waveClearBonus?.perLifeBonus)
                  ? config.waveClearBonus?.perLifeBonus
                  : ''
              }
              onChange={(event) =>
                setWaveBonusField('perLifeBonus', event.target.value)
              }
            />
            {wavePerLifeEnabled &&
              getIssueForPath('waveClearBonus.perLifeBonus') && (
                <div className={styles.errorInline}>
                  {getIssueForPath('waveClearBonus.perLifeBonus')?.message}
                </div>
              )}
          </label>
        </div>
        <div className={styles.helper}>
          Example (livesRemaining=3, levelMultiplier=1):{' '}
          {(
            Number(config.waveClearBonus?.base ?? 0) +
            Number(config.waveClearBonus?.perLifeBonus ?? 0) * 3
          ).toFixed(0)}
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h2>Accuracy Bonus</h2>
          <button
            className={styles.secondaryBtn}
            type="button"
            onClick={addAccuracyThreshold}
            disabled={loading || saving}
          >
            Add threshold
          </button>
        </div>
        <div className={styles.helper}>
          Thresholds use decimal accuracy values from 0 to 1. At run end, the
          highest threshold met is applied (no stacking).
        </div>
        <div className={styles.helper}>
          Thresholds must be in ascending order; unsorted rows block publish.
        </div>
        {accuracyThresholdIssues.length > 0 && (
          <div className={styles.error}>
            Accuracy threshold errors: {accuracyThresholdIssues.length}
          </div>
        )}
        <div className={styles.table}>
          <div className={styles.accuracyHeader}>
            <span>Threshold (0..1)</span>
            <span>Bonus</span>
            <span>Actions</span>
          </div>
          {accuracyThresholds.map((threshold, idx) => (
            <div
              key={threshold.uiId ?? `accuracy-${idx}`}
              className={styles.accuracyRow}
            >
              <div>
                <input
                  className={styles.input}
                  type="number"
                  step={0.01}
                  min={0}
                  max={1}
                  value={
                    Number.isFinite(threshold.minAccuracy)
                      ? threshold.minAccuracy
                      : ''
                  }
                  onChange={(event) =>
                    updateAccuracyThresholdField(
                      threshold.uiId ?? '',
                      'minAccuracy',
                      event.target.value,
                    )
                  }
                />
                {getIssueForAccuracyPath(idx, 'minAccuracy') && (
                  <div className={styles.errorInline}>
                    {getIssueForAccuracyPath(idx, 'minAccuracy')?.message}
                  </div>
                )}
              </div>
              <div>
                <input
                  className={styles.input}
                  type="number"
                  step={1}
                  min={0}
                  value={
                    Number.isFinite(threshold.bonus) ? threshold.bonus : ''
                  }
                  onChange={(event) =>
                    updateAccuracyThresholdField(
                      threshold.uiId ?? '',
                      'bonus',
                      event.target.value,
                    )
                  }
                />
                {getIssueForAccuracyPath(idx, 'bonus') && (
                  <div className={styles.errorInline}>
                    {getIssueForAccuracyPath(idx, 'bonus')?.message}
                  </div>
                )}
              </div>
              <div className={styles.comboActions}>
                <button
                  className={styles.secondaryBtn}
                  type="button"
                  onClick={() =>
                    moveAccuracyThreshold(threshold.uiId ?? '', 'up')
                  }
                  disabled={idx === 0 || saving}
                >
                  Up
                </button>
                <button
                  className={styles.secondaryBtn}
                  type="button"
                  onClick={() =>
                    moveAccuracyThreshold(threshold.uiId ?? '', 'down')
                  }
                  disabled={idx === accuracyThresholds.length - 1 || saving}
                >
                  Down
                </button>
                <button
                  className={styles.secondaryBtn}
                  type="button"
                  onClick={() => removeAccuracyThreshold(threshold.uiId ?? '')}
                  disabled={saving}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {accuracyThresholds.length === 0 && (
            <div className={styles.helper}>
              No thresholds configured. This is valid and applies no accuracy
              bonus.
            </div>
          )}
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h2>Base Enemy Scores</h2>
          <button
            className={styles.secondaryBtn}
            type="button"
            onClick={addMissingEnemyRows}
            disabled={loading || saving || enemies.length === 0}
          >
            Add missing enemy rows
          </button>
        </div>
        <div className={styles.helper}>
          Enemy list is sourced from published EnemyCatalog. Missing scores are
          blocking.
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span>Enemy</span>
              <span>Score</span>
              <span>Status</span>
            </div>
            {enemies.map((enemy) => {
              const score = scoreByEnemyId.get(enemy.enemyId);
              const issue = getIssueForEnemy(enemy.enemyId);
              const status = issue ? 'Missing/Error' : 'OK';

              return (
                <div key={enemy.enemyId} className={styles.tableRow}>
                  <span>
                    <strong>{enemy.displayName ?? enemy.enemyId}</strong>
                    <div className={styles.rowMeta}>{enemy.enemyId}</div>
                  </span>
                  <div>
                    <input
                      className={styles.input}
                      type="number"
                      min={0}
                      step={1}
                      value={typeof score === 'number' ? score : ''}
                      onChange={(event) =>
                        setEnemyScore(enemy.enemyId, event.target.value)
                      }
                    />
                    {issue && (
                      <div className={styles.errorInline}>{issue.message}</div>
                    )}
                  </div>
                  <span
                    className={issue ? styles.badgeError : styles.badgeSuccess}
                  >
                    {status}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {unknownBaseScoreRows.length > 0 && (
          <div className={styles.warning}>
            {unknownBaseScoreRows.length} base score row(s) reference enemyIds
            not in published EnemyCatalog and will block publish until fixed.
          </div>
        )}
      </section>
    </div>
  );
}
