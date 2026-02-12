'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from '../page.module.css';

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
  updatedAt?: string;
};

type ValidationIssue = {
  path?: string;
  message: string;
  severity: 'error' | 'warning';
};

export default function ScoreConfigPage() {
  const [config, setConfig] = useState<ScoreConfig>({
    scoreConfigId: 'default',
    baseEnemyScores: [],
    levelScoreMultiplier: { base: 1, perLevel: 0, max: 1 },
  });
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
        if (!cancelled) {
          const loaded = cfgJson.config ?? { scoreConfigId: 'default', baseEnemyScores: [] };
          setConfig({
            scoreConfigId: loaded.scoreConfigId ?? 'default',
            baseEnemyScores: loaded.baseEnemyScores ?? [],
            levelScoreMultiplier:
              loaded.levelScoreMultiplier ?? { base: 1, perLevel: 0, max: 1 },
            updatedAt: loaded.updatedAt,
          });
          setEnemies(enemyJson.enemies ?? []);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Load failed';
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const scoreMap = useMemo(() => {
    const map = new Map<string, number>();
    (config.baseEnemyScores ?? []).forEach((row) => {
      if (row.enemyId) map.set(row.enemyId, row.score ?? 0);
    });
    return map;
  }, [config.baseEnemyScores]);

  const issues: ValidationIssue[] = useMemo(() => {
    const list: ValidationIssue[] = [];
    enemies.forEach((e) => {
      const score = scoreMap.get(e.enemyId);
      if (score === undefined) {
        list.push({
          severity: 'error',
          path: `baseEnemyScores.${e.enemyId}`,
          message: `Missing score for enemy '${e.enemyId}'.`,
        });
      } else if (score < 0) {
        list.push({
          severity: 'error',
          path: `baseEnemyScores.${e.enemyId}`,
          message: `Score must be >= 0 (enemy ${e.enemyId}).`,
        });
      }
    });
    const mult = config.levelScoreMultiplier ?? { base: 1, perLevel: 0, max: 1 };
    if (mult.base < 1) {
      list.push({
        severity: 'error',
        path: 'levelScoreMultiplier.base',
        message: 'Base multiplier must be ≥ 1.0.',
      });
    }
    if (mult.perLevel < 0) {
      list.push({
        severity: 'error',
        path: 'levelScoreMultiplier.perLevel',
        message: 'Per-level increment must be ≥ 0.',
      });
    }
    if (mult.max < 1) {
      list.push({
        severity: 'error',
        path: 'levelScoreMultiplier.max',
        message: 'Max multiplier must be ≥ 1.0.',
      });
    }
    if (mult.max < mult.base) {
      list.push({
        severity: 'error',
        path: 'levelScoreMultiplier.max',
        message: 'Max multiplier must be ≥ base multiplier.',
      });
    }
    return list;
  }, [enemies, scoreMap, config.levelScoreMultiplier]);

  const hasBlocking = issues.some((i) => i.severity === 'error');

  const updateScore = (enemyId: string, value: number) => {
    setConfig((c) => {
      const rows = [...(c.baseEnemyScores ?? [])];
      const idx = rows.findIndex((r) => r.enemyId === enemyId);
      if (idx >= 0) {
        rows[idx] = { enemyId, score: value };
      } else {
        rows.push({ enemyId, score: value });
      }
      return { ...c, baseEnemyScores: rows };
    });
  };

  const updateMultiplier = (key: 'base' | 'perLevel' | 'max', value: number) => {
    setConfig((c) => ({
      ...c,
      levelScoreMultiplier: {
        base: c.levelScoreMultiplier?.base ?? 1,
        perLevel: c.levelScoreMultiplier?.perLevel ?? 0,
        max: c.levelScoreMultiplier?.max ?? 1,
        [key]: value,
      },
    }));
  };

  const exampleMultiplier = (level: number) => {
    const mult = config.levelScoreMultiplier ?? { base: 1, perLevel: 0, max: 1 };
    const raw = mult.base + (level - 1) * mult.perLevel;
    return Math.min(raw, mult.max);
  };

  async function onSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/score-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseEnemyScores: config.baseEnemyScores,
          levelScoreMultiplier: config.levelScoreMultiplier,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Save failed');
      }
      const j = await res.json();
      setConfig(j.config);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.pageHeader}>
        <div>
          <h1>ScoreConfig</h1>
          <p className={styles.meta}>Base enemy scores</p>
        </div>
        <button className={styles.saveBtn} onClick={onSave} disabled={saving || loading || hasBlocking}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {error && <div className={styles.error}>Error: {error}</div>}
      {savedAt && <div className={styles.success}>Saved at {savedAt}</div>}

      <section className={styles.card}>
        <h2>Publish readiness</h2>
        {issues.length === 0 ? (
          <div className={styles.success}>Ready to publish</div>
        ) : (
          <ul className={styles.issueList}>
            {issues.map((i, idx) => (
              <li key={idx}>
                <strong>{i.path ?? ''}</strong> {i.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.card}>
        <h2>Level Multipliers</h2>
        <div className={styles.fieldRow}>
          <label>Base</label>
          <input
            className={styles.input}
            type="number"
            min={1}
            step={0.1}
            value={config.levelScoreMultiplier?.base ?? 1}
            onChange={(e) => updateMultiplier('base', Number(e.target.value))}
          />
          {issues.find((i) => i.path === 'levelScoreMultiplier.base') && (
            <div className={styles.error}>
              {issues.find((i) => i.path === 'levelScoreMultiplier.base')?.message}
            </div>
          )}
        </div>
        <div className={styles.fieldRow}>
          <label>Per Level</label>
          <input
            className={styles.input}
            type="number"
            min={0}
            step={0.05}
            value={config.levelScoreMultiplier?.perLevel ?? 0}
            onChange={(e) => updateMultiplier('perLevel', Number(e.target.value))}
          />
          {issues.find((i) => i.path === 'levelScoreMultiplier.perLevel') && (
            <div className={styles.error}>
              {issues.find((i) => i.path === 'levelScoreMultiplier.perLevel')?.message}
            </div>
          )}
        </div>
        <div className={styles.fieldRow}>
          <label>Max</label>
          <input
            className={styles.input}
            type="number"
            min={1}
            step={0.1}
            value={config.levelScoreMultiplier?.max ?? 1}
            onChange={(e) => updateMultiplier('max', Number(e.target.value))}
          />
          {issues.find((i) => i.path === 'levelScoreMultiplier.max') && (
            <div className={styles.error}>
              {issues.find((i) => i.path === 'levelScoreMultiplier.max')?.message}
            </div>
          )}
        </div>
        <div className={styles.preview}>
          <p>Examples (capped):</p>
          <ul>
            <li>Level 1: {exampleMultiplier(1).toFixed(2)}</li>
            <li>Level 5: {exampleMultiplier(5).toFixed(2)}</li>
            <li>Level 10: {exampleMultiplier(10).toFixed(2)}</li>
          </ul>
        </div>
      </section>

      <section className={styles.card}>
        <h2>Base Enemy Scores</h2>
        {loading ? (
          <div>Loading…</div>
        ) : (
          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span>Enemy</span>
              <span>Score</span>
            </div>
            {enemies.map((e) => {
              const score = scoreMap.get(e.enemyId) ?? 0;
              const issue = issues.find((i) => i.path === `baseEnemyScores.${e.enemyId}`);
              return (
                <div key={e.enemyId} className={styles.tableRow}>
                  <span>{e.displayName ?? e.enemyId}</span>
                  <input
                    className={styles.input}
                    type="number"
                    min={0}
                    value={score}
                    onChange={(ev) => updateScore(e.enemyId, Number(ev.target.value))}
                  />
                  {issue && <div className={styles.error}>{issue.message}</div>}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
