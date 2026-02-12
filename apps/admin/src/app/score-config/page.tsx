'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from '../page.module.css';

type Enemy = { enemyId: string; displayName?: string };
type BaseEnemyScore = { enemyId: string; score: number };
type ScoreConfig = {
  scoreConfigId: string;
  baseEnemyScores: BaseEnemyScore[];
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
          setConfig(cfgJson.config ?? { scoreConfigId: 'default', baseEnemyScores: [] });
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
    return list;
  }, [enemies, scoreMap]);

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

  async function onSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/score-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseEnemyScores: config.baseEnemyScores }),
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
