'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from '../page.module.css';
import { validateScoreConfigDraft } from './validateScoreConfigDraft';
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
    combo: { enabled: true, tiers: [] },
    waveClearBonus: { base: 0, perLifeBonus: 0 },
    accuracyBonus: { scaleByLevelMultiplier: false, thresholds: [] },
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
            combo: loaded.combo ?? { enabled: true, tiers: [] },
            waveClearBonus: loaded.waveClearBonus ?? { base: 0, perLifeBonus: 0 },
            accuracyBonus:
              loaded.accuracyBonus ?? { scaleByLevelMultiplier: false, thresholds: [] },
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

  const issues: ValidationIssue[] = useMemo(
    () =>
      validateScoreConfigDraft(
        {
          baseEnemyScores: config.baseEnemyScores,
          levelScoreMultiplier: config.levelScoreMultiplier,
          combo: { tiers: config.combo?.tiers ?? [] },
          waveClearBonus: config.waveClearBonus,
          accuracyBonus: config.accuracyBonus,
        },
        { enemies },
      ),
    [config, enemies],
  );

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

  const addTier = () => {
    setConfig((c) => {
      const tiers = [...(c.combo?.tiers ?? [])];
      const last = tiers[tiers.length - 1];
      const nextMin = last ? last.minCount + 1 : 1;
      tiers.push({ minCount: nextMin, multiplier: 1, tierBonus: 0, name: `Tier ${tiers.length + 1}` });
      return {
        ...c,
        combo: { enabled: c.combo?.enabled ?? true, tiers },
      };
    });
  };

  const updateTier = (
    idx: number,
    key: 'minCount' | 'multiplier' | 'tierBonus' | 'name',
    value: number | string,
  ) => {
    setConfig((c) => {
      const tiers = [...(c.combo?.tiers ?? [])];
      const t = { ...tiers[idx] };
      if (key === 'name') {
        t.name = String(value);
      } else if (key === 'tierBonus') {
        t.tierBonus = Number(value);
      } else if (key === 'minCount') {
        t.minCount = Number(value);
      } else if (key === 'multiplier') {
        t.multiplier = Number(value);
      }
      tiers[idx] = t;
      return { ...c, combo: { enabled: c.combo?.enabled ?? true, tiers } };
    });
  };

  const removeTier = (idx: number) => {
    setConfig((c) => {
      const tiers = [...(c.combo?.tiers ?? [])];
      tiers.splice(idx, 1);
      return { ...c, combo: { enabled: c.combo?.enabled ?? true, tiers } };
    });
  };

  const moveTier = (idx: number, delta: number) => {
    setConfig((c) => {
      const tiers = [...(c.combo?.tiers ?? [])];
      const target = idx + delta;
      if (target < 0 || target >= tiers.length) return c;
      [tiers[idx], tiers[target]] = [tiers[target], tiers[idx]];
      return { ...c, combo: { enabled: c.combo?.enabled ?? true, tiers } };
    });
  };

  const exampleMultiplier = (level: number) => {
    const mult = config.levelScoreMultiplier ?? { base: 1, perLevel: 0, max: 1 };
    const raw = mult.base + (level - 1) * mult.perLevel;
    return Math.min(raw, mult.max);
  };

  const updateWaveBonus = (key: 'base' | 'perLifeBonus', value: number) => {
    setConfig((c) => ({
      ...c,
      waveClearBonus: {
        base: c.waveClearBonus?.base ?? 0,
        perLifeBonus: c.waveClearBonus?.perLifeBonus ?? 0,
        [key]: value,
      },
    }));
  };

  const addAccuracy = () => {
    setConfig((c) => ({
      ...c,
      accuracyBonus: {
        scaleByLevelMultiplier: c.accuracyBonus?.scaleByLevelMultiplier ?? false,
        thresholds: [
          ...(c.accuracyBonus?.thresholds ?? []),
          { minAccuracy: 0.5, bonus: 0 },
        ],
      },
    }));
  };

  const updateAccuracy = (
    idx: number,
    key: 'minAccuracy' | 'bonus',
    value: number,
  ) => {
    setConfig((c) => {
      const thresholds = [...(c.accuracyBonus?.thresholds ?? [])];
      const t = { ...thresholds[idx] };
      if (key === 'minAccuracy') t.minAccuracy = value;
      if (key === 'bonus') t.bonus = value;
      thresholds[idx] = t;
      return {
        ...c,
        accuracyBonus: {
          scaleByLevelMultiplier: c.accuracyBonus?.scaleByLevelMultiplier ?? false,
          thresholds,
        },
      };
    });
  };

  const removeAccuracy = (idx: number) => {
    setConfig((c) => {
      const thresholds = [...(c.accuracyBonus?.thresholds ?? [])];
      thresholds.splice(idx, 1);
      return {
        ...c,
        accuracyBonus: {
          scaleByLevelMultiplier: c.accuracyBonus?.scaleByLevelMultiplier ?? false,
          thresholds,
        },
      };
    });
  };

  const moveAccuracy = (idx: number, delta: number) => {
    setConfig((c) => {
      const thresholds = [...(c.accuracyBonus?.thresholds ?? [])];
      const target = idx + delta;
      if (target < 0 || target >= thresholds.length) return c;
      [thresholds[idx], thresholds[target]] = [thresholds[target], thresholds[idx]];
      return {
        ...c,
        accuracyBonus: {
          scaleByLevelMultiplier: c.accuracyBonus?.scaleByLevelMultiplier ?? false,
          thresholds,
        },
      };
    });
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
          combo: config.combo,
          waveClearBonus: config.waveClearBonus,
          accuracyBonus: config.accuracyBonus,
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
          <div>
            <div className={styles.error}>ScoreConfig has {issues.length} error(s).</div>
            <ul className={styles.issueList}>
              {issues.map((i, idx) => (
                <li key={idx}>
                  <strong>{i.path ?? ''}</strong> {i.message}
                </li>
              ))}
            </ul>
          </div>
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
        <h2>Combo Tiers</h2>
        <div className={styles.tableHeader}>
          <span>Tier</span>
          <span>minCount</span>
          <span>Multiplier</span>
          <span>Tier Bonus</span>
          <span />
        </div>
        {(config.combo?.tiers ?? []).map((t, idx) => {
          const minIssue = issues.find((i) => i.path === `combo.tiers.${idx}.minCount`);
          const mulIssue = issues.find((i) => i.path === `combo.tiers.${idx}.multiplier`);
          const bonusIssue = issues.find((i) => i.path === `combo.tiers.${idx}.tierBonus`);
          return (
            <div key={idx} className={styles.tableRow}>
              <span>{t.name ?? `Tier ${idx + 1}`}</span>
              <div>
                <input
                  className={styles.input}
                  type="number"
                  min={1}
                  step={1}
                  value={t.minCount}
                  onChange={(e) => updateTier(idx, 'minCount', Number(e.target.value))}
                />
                {minIssue && <div className={styles.error}>{minIssue.message}</div>}
              </div>
              <div>
                <input
                  className={styles.input}
                  type="number"
                  min={1}
                  step={0.1}
                  value={t.multiplier}
                  onChange={(e) => updateTier(idx, 'multiplier', Number(e.target.value))}
                />
                {mulIssue && <div className={styles.error}>{mulIssue.message}</div>}
              </div>
              <div>
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  step={0.1}
                  value={t.tierBonus ?? 0}
                  onChange={(e) => updateTier(idx, 'tierBonus', Number(e.target.value))}
                />
                {bonusIssue && <div className={styles.error}>{bonusIssue.message}</div>}
              </div>
              <div className={styles.actions}>
                <button type="button" onClick={() => moveTier(idx, -1)} disabled={idx === 0}>
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveTier(idx, 1)}
                  disabled={idx === (config.combo?.tiers?.length ?? 0) - 1}
                >
                  ↓
                </button>
                <button type="button" onClick={() => removeTier(idx)}>
                  Remove
                </button>
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: '12px' }}>
          <button type="button" onClick={addTier}>
            Add tier
          </button>
        </div>
      </section>

      <section className={styles.card}>
        <h2>Wave Bonus</h2>
        <div className={styles.fieldRow}>
          <label>Base wave bonus</label>
          <input
            className={styles.input}
            type="number"
            min={0}
            step={1}
            value={config.waveClearBonus?.base ?? 0}
            onChange={(e) => updateWaveBonus('base', Number(e.target.value))}
          />
          {issues.find((i) => i.path === 'waveClearBonus.base') && (
            <div className={styles.error}>
              {issues.find((i) => i.path === 'waveClearBonus.base')?.message}
            </div>
          )}
        </div>
        <div className={styles.fieldRow}>
          <label>Per-life bonus (optional)</label>
          <input
            className={styles.input}
            type="number"
            min={0}
            step={1}
            value={config.waveClearBonus?.perLifeBonus ?? 0}
            onChange={(e) => updateWaveBonus('perLifeBonus', Number(e.target.value))}
          />
          {issues.find((i) => i.path === 'waveClearBonus.perLifeBonus') && (
            <div className={styles.error}>
              {issues.find((i) => i.path === 'waveClearBonus.perLifeBonus')?.message}
            </div>
          )}
          <p className={styles.helper}>Leave at 0 if you don’t want per-life bonuses.</p>
        </div>
      </section>

      <section className={styles.card}>
        <h2>Accuracy Bonuses</h2>
        <p className={styles.helper}>
          Rule: highest threshold met applies. Example: thresholds 0.50 (+100), 0.75 (+250), 0.90 (+500);
          accuracy 0.82 → +250. Thresholds are stored as 0..1.
        </p>
        <div className={styles.tableHeader}>
          <span>Threshold (0..1)</span>
          <span>Bonus</span>
          <span />
        </div>
        {(config.accuracyBonus?.thresholds ?? []).map((t, idx) => {
          const thrIssue = issues.find((i) => i.path === `accuracyBonus.thresholds.${idx}.minAccuracy`);
          const bonusIssue = issues.find((i) => i.path === `accuracyBonus.thresholds.${idx}.bonus`);
          return (
            <div key={idx} className={styles.tableRow}>
              <div>
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={t.minAccuracy}
                  onChange={(e) => updateAccuracy(idx, 'minAccuracy', Number(e.target.value))}
                />
                {thrIssue && <div className={styles.error}>{thrIssue.message}</div>}
              </div>
              <div>
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  step={1}
                  value={t.bonus}
                  onChange={(e) => updateAccuracy(idx, 'bonus', Number(e.target.value))}
                />
                {bonusIssue && <div className={styles.error}>{bonusIssue.message}</div>}
              </div>
              <div className={styles.actions}>
                <button type="button" onClick={() => moveAccuracy(idx, -1)} disabled={idx === 0}>
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveAccuracy(idx, 1)}
                  disabled={idx === (config.accuracyBonus?.thresholds?.length ?? 0) - 1}
                >
                  ↓
                </button>
                <button type="button" onClick={() => removeAccuracy(idx)}>
                  Remove
                </button>
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: '12px' }}>
          <button type="button" onClick={addAccuracy}>
            Add threshold
          </button>
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
