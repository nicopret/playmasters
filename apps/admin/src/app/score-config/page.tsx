'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';
import {
  type ValidationIssue,
  validateScoreConfigDraft,
} from './validateScoreConfigDraft';

type Enemy = { enemyId: string; displayName?: string };

type BaseEnemyScore = { enemyId: string; score: number };

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
    tiers: {
      minCount: number;
      multiplier: number;
      tierBonus?: number;
      name?: string;
    }[];
    minWindowMs?: number;
    windowMs?: number;
    resetOnPlayerHit?: boolean;
    windowDecayPerLevelMs?: number;
  };
  waveClearBonus?: {
    base: number;
    perLifeBonus?: number;
  };
  accuracyBonus?: {
    scaleByLevelMultiplier?: boolean;
    thresholds: {
      minAccuracy: number;
      bonus: number;
    }[];
  };
  updatedAt?: string;
};

const DEFAULT_LEVEL_SCORE_MULTIPLIER = {
  base: 1,
  perLevel: 0,
  max: 1,
};

const DEFAULT_SCORE_CONFIG: ScoreConfig = {
  scoreConfigId: 'default',
  baseEnemyScores: [],
  levelScoreMultiplier: DEFAULT_LEVEL_SCORE_MULTIPLIER,
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

const normalizeScoreConfig = (config: ScoreConfig): ScoreConfig => ({
  ...config,
  levelScoreMultiplier:
    config.levelScoreMultiplier ?? DEFAULT_LEVEL_SCORE_MULTIPLIER,
});

export default function ScoreConfigPage() {
  const [config, setConfig] = useState<ScoreConfig>(DEFAULT_SCORE_CONFIG);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

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

        setConfig(normalizeScoreConfig(cfgJson.config ?? DEFAULT_SCORE_CONFIG));
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
        },
        { enemies },
      ),
    [config.baseEnemyScores, config.levelScoreMultiplier, enemies],
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
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Save failed');
      }

      const payload = await res.json();
      setConfig(payload.config ?? DEFAULT_SCORE_CONFIG);
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
