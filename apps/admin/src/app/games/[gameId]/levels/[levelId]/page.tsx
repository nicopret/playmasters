'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import styles from './page.module.css';
import { validateLevelDraft, ValidationIssue } from './validateLevelDraft';

type BackgroundItem = {
  assetId: string;
  title: string;
  tags: string[];
  width: number;
  height: number;
  publishedVersionId: string;
  publishedUrl: string;
  updatedAt: string;
};

type FormationLayout = {
  layoutId: string;
  rows: number;
  cols: number;
  spacingX?: number;
  spacingY?: number;
};

type EnemyOption = {
  enemyId: string;
  displayName?: string;
};

type WaveEnemy = { enemyId: string; count: number };
type Wave = { enemies: WaveEnemy[]; overrides?: Record<string, unknown> };

type LevelConfig = {
  gameId: string;
  levelId: string;
  layoutId?: string;
  backgroundAssetId?: string;
  backgroundVersionId?: string;
  pinnedToVersion?: boolean;
  updatedAt?: string;
  waves: Wave[];
  fleetSpeed?: number;
  rampFactor?: number;
  descendStep?: number;
  maxConcurrentDivers?: number;
  maxConcurrentShots?: number;
  attackTickMs?: number;
  diveChancePerTick?: number;
  divePattern?: 'straight' | 'sine' | 'track';
  turnRate?: number;
  fireTickMs?: number;
  fireChancePerTick?: number;
};

export default function LevelConfigPage() {
  const { gameId, levelId } = useParams<{ gameId: string; levelId: string }>();
  if (!gameId || !levelId) {
    return <div className={styles.page}>Missing route parameters</div>;
  }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backgrounds, setBackgrounds] = useState<BackgroundItem[]>([]);
  const [layouts, setLayouts] = useState<FormationLayout[]>([]);
  const [enemies, setEnemies] = useState<EnemyOption[]>([]);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [config, setConfig] = useState<LevelConfig>({
    gameId,
    levelId,
    waves: [],
    fleetSpeed: 0,
    rampFactor: 0,
    descendStep: 0,
    maxConcurrentDivers: 0,
    maxConcurrentShots: 0,
    attackTickMs: 1000,
    diveChancePerTick: 0,
    divePattern: 'straight',
    turnRate: 0,
    fireTickMs: 1000,
    fireChancePerTick: 0,
  });
  const [originalKnobs, setOriginalKnobs] = useState<Pick<
    LevelConfig,
    | 'fleetSpeed'
    | 'rampFactor'
    | 'descendStep'
    | 'maxConcurrentDivers'
    | 'maxConcurrentShots'
    | 'attackTickMs'
    | 'diveChancePerTick'
    | 'divePattern'
    | 'turnRate'
    | 'fireTickMs'
    | 'fireChancePerTick'
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const [cfgRes, bgRes, layoutRes, enemyRes] = await Promise.all([
          fetch(`/api/games/${gameId}/levels/${levelId}`),
          fetch(`/api/catalog/backgrounds`),
          fetch(`/api/catalog/formation-layouts`),
          fetch(`/api/catalog/enemies`),
        ]);
        if (!cfgRes.ok) throw new Error('Failed to load level');
        if (!bgRes.ok) throw new Error('Failed to load backgrounds');
        if (!layoutRes.ok) throw new Error('Failed to load formation layouts');
        if (!enemyRes.ok) throw new Error('Failed to load enemies');
          const cfgJson = await cfgRes.json();
        const bgJson = await bgRes.json();
        const layoutJson = await layoutRes.json();
        const enemyJson = await enemyRes.json();
        if (!cancelled) {
          const cfgData =
            cfgJson.config ??
            ({
              gameId,
              levelId,
              waves: [],
              fleetSpeed: 0,
              rampFactor: 0,
              descendStep: 0,
              maxConcurrentDivers: 0,
              maxConcurrentShots: 0,
              attackTickMs: 1000,
              diveChancePerTick: 0,
              divePattern: 'straight',
              turnRate: 0,
              fireTickMs: 1000,
              fireChancePerTick: 0,
            } as LevelConfig);
          setConfig({
            ...cfgData,
            waves: Array.isArray(cfgData.waves) ? cfgData.waves : [],
            fleetSpeed: cfgData.fleetSpeed ?? 0,
            rampFactor: cfgData.rampFactor ?? 0,
            descendStep: cfgData.descendStep ?? 0,
            maxConcurrentDivers: cfgData.maxConcurrentDivers ?? 0,
            maxConcurrentShots: cfgData.maxConcurrentShots ?? 0,
            attackTickMs: cfgData.attackTickMs ?? 1000,
            diveChancePerTick: cfgData.diveChancePerTick ?? 0,
            divePattern: (cfgData.divePattern as any) ?? 'straight',
            turnRate: cfgData.turnRate ?? 0,
            fireTickMs: cfgData.fireTickMs ?? 1000,
            fireChancePerTick: cfgData.fireChancePerTick ?? 0,
          });
          setOriginalKnobs({
            fleetSpeed: cfgData.fleetSpeed ?? 0,
            rampFactor: cfgData.rampFactor ?? 0,
            descendStep: cfgData.descendStep ?? 0,
            maxConcurrentDivers: cfgData.maxConcurrentDivers ?? 0,
            maxConcurrentShots: cfgData.maxConcurrentShots ?? 0,
            attackTickMs: cfgData.attackTickMs ?? 1000,
            diveChancePerTick: cfgData.diveChancePerTick ?? 0,
            divePattern: (cfgData.divePattern as any) ?? 'straight',
            turnRate: cfgData.turnRate ?? 0,
            fireTickMs: cfgData.fireTickMs ?? 1000,
            fireChancePerTick: cfgData.fireChancePerTick ?? 0,
          });
          setBackgrounds(bgJson.backgrounds ?? []);
          setLayouts(layoutJson.layouts ?? []);
          setEnemies(enemyJson.enemies ?? []);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [gameId, levelId]);

  const selectedBg = useMemo(
    () => backgrounds.find((b) => b.assetId === config.backgroundAssetId),
    [backgrounds, config.backgroundAssetId],
  );

  const pinnedVersionId =
    config.pinnedToVersion && config.backgroundVersionId
      ? config.backgroundVersionId
      : selectedBg?.publishedVersionId;

  const selectedLayout = useMemo(
    () => layouts.find((l) => l.layoutId === config.layoutId),
    [layouts, config.layoutId],
  );

  const layoutError =
    !loading &&
    (!config.layoutId
      ? 'Layout is required'
      : !selectedLayout
        ? 'Selected layout is not published'
        : null);

  const waveErrors = (config.waves ?? []).map((w) => {
    const counts = (w.enemies ?? []).map((e) => e.count ?? 0);
    const negative = counts.some((c) => c < 0);
    const total = counts.reduce((s, c) => s + c, 0);
    return negative ? 'Counts must be >= 0' : total <= 0 ? 'Wave must have enemies' : null;
  });
  const wavesError =
    !loading && (config.waves?.length ?? 0) === 0
      ? 'At least one wave is required'
      : waveErrors.find((e) => e) ?? null;

  const knobErrors: Partial<Record<keyof LevelConfig, string>> = {};
  if ((config.fleetSpeed ?? 0) < 0) knobErrors.fleetSpeed = 'Must be >= 0';
  if ((config.rampFactor ?? 0) < 0 || (config.rampFactor ?? 0) > 1)
    knobErrors.rampFactor = 'Must be between 0 and 1';
  if ((config.descendStep ?? 0) < 0) knobErrors.descendStep = 'Must be >= 0';
  if ((config.maxConcurrentDivers ?? 0) < 0) knobErrors.maxConcurrentDivers = 'Must be >= 0';
  if ((config.maxConcurrentShots ?? 0) < 0) knobErrors.maxConcurrentShots = 'Must be >= 0';
  if ((config.attackTickMs ?? 0) < 1) knobErrors.attackTickMs = 'Must be at least 1 ms';
  if ((config.diveChancePerTick ?? 0) < 0 || (config.diveChancePerTick ?? 0) > 1)
    knobErrors.diveChancePerTick = 'Must be between 0 and 1';
  if (config.divePattern && !['straight', 'sine', 'track'].includes(config.divePattern))
    knobErrors.divePattern = 'Invalid pattern';
  const trackingEnabled = config.divePattern === 'track';
  const MAX_TURN_RATE = 10;
  if (trackingEnabled) {
    if ((config.turnRate ?? 0) < 0 || (config.turnRate ?? 0) > MAX_TURN_RATE) {
      knobErrors.turnRate = `Must be between 0 and ${MAX_TURN_RATE}`;
    }
  }
  if ((config.fireTickMs ?? 0) < 1) knobErrors.fireTickMs = 'Must be at least 1 ms';
  if ((config.fireChancePerTick ?? 0) < 0 || (config.fireChancePerTick ?? 0) > 1)
    knobErrors.fireChancePerTick = 'Must be between 0 and 1';

  const knobChanged =
    originalKnobs &&
    ['fleetSpeed', 'rampFactor', 'descendStep', 'maxConcurrentDivers', 'maxConcurrentShots'].some(
      (k) => (config as any)[k] !== (originalKnobs as any)[k],
    );
  const diveKnobChanged =
    originalKnobs &&
    ['attackTickMs', 'diveChancePerTick', 'divePattern', 'turnRate', 'maxConcurrentDivers'].some(
      (k) => (config as any)[k] !== (originalKnobs as any)[k],
    );
  const shootKnobChanged =
    originalKnobs &&
    ['fireTickMs', 'fireChancePerTick', 'maxConcurrentShots'].some(
      (k) => (config as any)[k] !== (originalKnobs as any)[k],
    );

  useEffect(() => {
    const nextIssues = validateLevelDraft(config, {
      enemies,
      layouts,
    });
    setIssues(nextIssues);
  }, [config, enemies, layouts]);

  async function onSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/games/${gameId}/levels/${levelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layoutId: config.layoutId,
          backgroundAssetId: config.backgroundAssetId,
          backgroundVersionId: config.pinnedToVersion
            ? (config.backgroundVersionId ?? selectedBg?.publishedVersionId)
            : undefined,
          pinToVersion: config.pinnedToVersion,
          fleetSpeed: config.fleetSpeed,
          rampFactor: config.rampFactor,
          descendStep: config.descendStep,
          maxConcurrentDivers: config.maxConcurrentDivers,
          maxConcurrentShots: config.maxConcurrentShots,
          waves: config.waves,
          attackTickMs: config.attackTickMs,
          diveChancePerTick: config.diveChancePerTick,
          divePattern: config.divePattern,
          turnRate: config.turnRate,
          fireTickMs: config.fireTickMs,
          fireChancePerTick: config.fireChancePerTick,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Save failed');
      }
      const j = await res.json();
      setConfig(j.config);
      setOriginalKnobs({
        fleetSpeed: j.config.fleetSpeed ?? 0,
        rampFactor: j.config.rampFactor ?? 0,
        descendStep: j.config.descendStep ?? 0,
        maxConcurrentDivers: j.config.maxConcurrentDivers ?? 0,
        maxConcurrentShots: j.config.maxConcurrentShots ?? 0,
        attackTickMs: j.config.attackTickMs ?? 1000,
        diveChancePerTick: j.config.diveChancePerTick ?? 0,
        divePattern: (j.config.divePattern as any) ?? 'straight',
        turnRate: j.config.turnRate ?? 0,
        fireTickMs: j.config.fireTickMs ?? 1000,
        fireChancePerTick: j.config.fireChancePerTick ?? 0,
      });
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const bgLabel = (bg: BackgroundItem) =>
    `${bg.title} (${bg.width}x${bg.height})`;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Level Config</h1>
          <div className={styles.meta}>
            Game <code>{gameId}</code> · Level <code>{levelId}</code>
          </div>
        </div>
        <button
          className={styles.saveBtn}
          onClick={onSave}
          disabled={
            saving ||
            loading ||
            !!layoutError ||
            !!wavesError ||
            Object.keys(knobErrors).length > 0 ||
            issues.some((i) => i.severity === 'error')
          }
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </header>

      {error && <div className={styles.error}>Error: {error}</div>}
      {savedAt && <div className={styles.success}>Saved at {savedAt}</div>}

      <section className={styles.card}>
        <h2>Publish readiness</h2>
        {issues.length === 0 ? (
          <div className={styles.success}>Ready to publish</div>
        ) : (
          <>
            <div className={styles.error}>
              Not ready: {issues.filter((i) => i.severity === 'error').length} blocking issue(s)
            </div>
            <ul className={styles.issueList}>
              {issues.map((i, idx) => (
                <li key={idx}>
                  <strong>{i.path ?? '(general)'}</strong>: {i.message}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className={styles.card}>
        <h2>Difficulty / Fleet Behavior</h2>
        {knobChanged && (
          <div className={styles.warning}>
            Warning: Changing these values affects difficulty and may impact leaderboard
            comparability. Consider resetting or segmenting leaderboards when publishing.
          </div>
        )}
        <div className={styles.grid2}>
          <label className={styles.label}>
            Fleet speed
            <input
              className={styles.input}
              type="number"
              min={0}
              step={0.1}
              value={config.fleetSpeed ?? 0}
              onChange={(e) =>
                setConfig((c) => ({ ...c, fleetSpeed: Number(e.target.value) }))
              }
            />
            {knobErrors.fleetSpeed && <div className={styles.error}>{knobErrors.fleetSpeed}</div>}
          </label>
          <label className={styles.label}>
            Ramp factor
            <input
              className={styles.input}
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={config.rampFactor ?? 0}
              onChange={(e) =>
                setConfig((c) => ({ ...c, rampFactor: Number(e.target.value) }))
              }
            />
            {knobErrors.rampFactor && <div className={styles.error}>{knobErrors.rampFactor}</div>}
          </label>
          <label className={styles.label}>
            Descend step
            <input
              className={styles.input}
              type="number"
              min={0}
              step={1}
              value={config.descendStep ?? 0}
              onChange={(e) =>
                setConfig((c) => ({ ...c, descendStep: Number(e.target.value) }))
              }
            />
            {knobErrors.descendStep && <div className={styles.error}>{knobErrors.descendStep}</div>}
          </label>
          <label className={styles.label}>
            Max concurrent divers
            <input
              className={styles.input}
              type="number"
              min={0}
              step={1}
              value={config.maxConcurrentDivers ?? 0}
              onChange={(e) =>
                setConfig((c) => ({ ...c, maxConcurrentDivers: Number(e.target.value) }))
              }
            />
            {knobErrors.maxConcurrentDivers && (
              <div className={styles.error}>{knobErrors.maxConcurrentDivers}</div>
            )}
          </label>
          <label className={styles.label}>
            Max concurrent shots
            <input
              className={styles.input}
              type="number"
              min={0}
              step={1}
              value={config.maxConcurrentShots ?? 0}
              onChange={(e) =>
                setConfig((c) => ({ ...c, maxConcurrentShots: Number(e.target.value) }))
              }
            />
            {knobErrors.maxConcurrentShots && (
              <div className={styles.error}>{knobErrors.maxConcurrentShots}</div>
            )}
          </label>
        </div>
      </section>

      <section className={styles.card}>
        <h2>Dive / Attack</h2>
        {diveKnobChanged && (
          <div className={styles.warning}>
            Warning: Changing dive/attack tuning affects difficulty and leaderboard comparability.
          </div>
        )}
        <div className={styles.grid2}>
          <label className={styles.label}>
            attackTickMs
            <input
              className={styles.input}
              type="number"
              min={1}
              step={1}
              value={config.attackTickMs ?? 1}
              onChange={(e) =>
                setConfig((c) => ({ ...c, attackTickMs: Number(e.target.value) }))
              }
            />
            {knobErrors.attackTickMs && (
              <div className={styles.error}>{knobErrors.attackTickMs}</div>
            )}
          </label>
          <label className={styles.label}>
            diveChancePerTick
            <input
              className={styles.input}
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={config.diveChancePerTick ?? 0}
              onChange={(e) =>
                setConfig((c) => ({ ...c, diveChancePerTick: Number(e.target.value) }))
              }
            />
            {knobErrors.diveChancePerTick && (
              <div className={styles.error}>{knobErrors.diveChancePerTick}</div>
            )}
          </label>
          <label className={styles.label}>
            Pattern
            <select
              className={styles.select}
              value={config.divePattern ?? 'straight'}
              onChange={(e) =>
                setConfig((c) => ({ ...c, divePattern: e.target.value as any }))
              }
            >
              <option value="straight">Straight</option>
              <option value="sine">Sine</option>
              <option value="track">Track</option>
            </select>
            {knobErrors.divePattern && <div className={styles.error}>{knobErrors.divePattern}</div>}
          </label>
          {trackingEnabled && (
            <label className={styles.label}>
              turnRate
              <input
                className={styles.input}
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={config.turnRate ?? 0}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, turnRate: Number(e.target.value) }))
                }
              />
              <div className={styles.helper}>Capped to prevent perfect tracking.</div>
              {knobErrors.turnRate && <div className={styles.error}>{knobErrors.turnRate}</div>}
            </label>
          )}
        </div>
      </section>

      <section className={styles.card}>
        <h2>Shooting</h2>
        {shootKnobChanged && (
          <div className={styles.warning}>
            Warning: Changing shooting tuning affects difficulty and leaderboard comparability.
          </div>
        )}
        <div className={styles.grid2}>
          <label className={styles.label}>
            fireTickMs
            <input
              className={styles.input}
              type="number"
              min={1}
              step={1}
              value={config.fireTickMs ?? 1}
              onChange={(e) => setConfig((c) => ({ ...c, fireTickMs: Number(e.target.value) }))}
            />
            {knobErrors.fireTickMs && <div className={styles.error}>{knobErrors.fireTickMs}</div>}
          </label>
          <label className={styles.label}>
            fireChancePerTick
            <input
              className={styles.input}
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={config.fireChancePerTick ?? 0}
              onChange={(e) =>
                setConfig((c) => ({ ...c, fireChancePerTick: Number(e.target.value) }))
              }
            />
            {knobErrors.fireChancePerTick && (
              <div className={styles.error}>{knobErrors.fireChancePerTick}</div>
            )}
          </label>
          <label className={styles.label}>
            Max concurrent shots
            <input
              className={styles.input}
              type="number"
              min={0}
              step={1}
              value={config.maxConcurrentShots ?? 0}
              onChange={(e) =>
                setConfig((c) => ({ ...c, maxConcurrentShots: Number(e.target.value) }))
              }
            />
            {knobErrors.maxConcurrentShots && (
              <div className={styles.error}>{knobErrors.maxConcurrentShots}</div>
            )}
          </label>
        </div>
        <div className={styles.helper}>
          <strong>Shooting Rule:</strong> Column Shooter (locked). Only the bottom-most living enemy
          in each column may fire. This is a core fairness rule and not editable in v1.
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>Waves</h2>
          <button
            className={styles.saveBtn}
            onClick={() =>
              setConfig((c) => ({
                ...c,
                waves: [...(c.waves ?? []), { enemies: [] }],
              }))
            }
          >
            Add wave
          </button>
        </div>
        {wavesError && <div className={styles.error}>{wavesError}</div>}
        {(config.waves ?? []).map((wave, idx) => {
          const total = (wave.enemies ?? []).reduce((s, e) => s + (e.count ?? 0), 0);
          const waveError = waveErrors[idx] ?? null;
          return (
            <div key={idx} className={styles.waveCard}>
              <div className={styles.waveHeader}>
                <div>
                  <strong>Wave {idx + 1}</strong> {total ? `• ${total} enemies` : ''}
                  {waveError && <span className={styles.errorInline}> {waveError}</span>}
                </div>
                <div className={styles.waveActions}>
                  <button
                    disabled={idx === 0}
                    onClick={() =>
                      setConfig((c) => {
                        const waves = [...(c.waves ?? [])];
                        [waves[idx - 1], waves[idx]] = [waves[idx], waves[idx - 1]];
                        return { ...c, waves };
                      })
                    }
                  >
                    ↑
                  </button>
                  <button
                    disabled={idx === (config.waves?.length ?? 1) - 1}
                    onClick={() =>
                      setConfig((c) => {
                        const waves = [...(c.waves ?? [])];
                        [waves[idx + 1], waves[idx]] = [waves[idx], waves[idx + 1]];
                        return { ...c, waves };
                      })
                    }
                  >
                    ↓
                  </button>
                  <button
                    onClick={() =>
                      setConfig((c) => ({
                        ...c,
                        waves: (c.waves ?? []).filter((_, i) => i !== idx),
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className={styles.table}>
                <div className={styles.tableHeader}>
                  <span>Enemy</span>
                  <span>Count</span>
                  <span></span>
                </div>
                {(wave.enemies ?? []).map((row, rIdx) => (
                  <div key={rIdx} className={styles.tableRow}>
                    <select
                      className={styles.select}
                      value={row.enemyId ?? ''}
                      onChange={(e) =>
                        setConfig((c) => {
                          const waves = [...(c.waves ?? [])];
                          const enemies = [...(waves[idx].enemies ?? [])];
                          enemies[rIdx] = { ...enemies[rIdx], enemyId: e.target.value };
                          waves[idx] = { ...waves[idx], enemies };
                          return { ...c, waves };
                        })
                      }
                    >
                      <option value="">— Select enemy —</option>
                      {enemies.map((e) => (
                        <option key={e.enemyId} value={e.enemyId}>
                          {e.displayName ?? e.enemyId}
                        </option>
                      ))}
                    </select>
                    <input
                      className={styles.input}
                      type="number"
                      min={0}
                      value={row.count ?? 0}
                      onChange={(e) =>
                        setConfig((c) => {
                          const waves = [...(c.waves ?? [])];
                          const enemies = [...(waves[idx].enemies ?? [])];
                          enemies[rIdx] = {
                            ...enemies[rIdx],
                            count: Number(e.target.value),
                          };
                          waves[idx] = { ...waves[idx], enemies };
                          return { ...c, waves };
                        })
                      }
                    />
                    <button
                      onClick={() =>
                        setConfig((c) => {
                          const waves = [...(c.waves ?? [])];
                          const enemies = [...(waves[idx].enemies ?? [])].filter(
                            (_, i) => i !== rIdx,
                          );
                          waves[idx] = { ...waves[idx], enemies };
                          return { ...c, waves };
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div className={styles.tableFooter}>
                  <button
                    onClick={() =>
                      setConfig((c) => {
                        const waves = [...(c.waves ?? [])];
                        const enemies = [...(waves[idx].enemies ?? []), { enemyId: '', count: 0 }];
                        waves[idx] = { ...waves[idx], enemies };
                        return { ...c, waves };
                      })
                    }
                  >
                    Add enemy
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className={styles.card}>
        <h2>Formation Layout</h2>
        {loading ? (
          <div>Loading…</div>
        ) : (
          <>
            <label className={styles.label}>
              Choose published layout
              <select
                className={styles.select}
                value={config.layoutId ?? ''}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    layoutId: e.target.value || undefined,
                  }))
                }
              >
                <option value="">— Select layout —</option>
                {layouts.map((l) => (
                  <option key={l.layoutId} value={l.layoutId}>
                    {l.layoutId} ({l.rows}x{l.cols})
                  </option>
                ))}
              </select>
            </label>
            {selectedLayout && (
              <div className={styles.helper}>
                <div>
                  <strong>Grid:</strong> {selectedLayout.rows} rows ×{' '}
                  {selectedLayout.cols} cols
                </div>
                <div>
                  <strong>Spacing:</strong>{' '}
                  {selectedLayout.spacingX ?? '—'} / {selectedLayout.spacingY ?? '—'}
                </div>
              </div>
            )}
            {layoutError && <div className={styles.error}>{layoutError}</div>}
          </>
        )}
      </section>

      <section className={styles.card}>
        <h2>Background</h2>
        {loading ? (
          <div>Loading…</div>
        ) : (
          <>
            <label className={styles.label}>
              Choose published background
              <select
                className={styles.select}
                value={config.backgroundAssetId ?? ''}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    backgroundAssetId: e.target.value || undefined,
                    backgroundVersionId: e.target.value
                      ? backgrounds.find((b) => b.assetId === e.target.value)
                          ?.publishedVersionId
                      : undefined,
                  }))
                }
              >
                <option value="">— None —</option>
                {backgrounds.map((bg) => (
                  <option key={bg.assetId} value={bg.assetId}>
                    {bgLabel(bg)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={!!config.pinnedToVersion}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    pinnedToVersion: e.target.checked,
                    backgroundVersionId: e.target.checked
                      ? c.backgroundVersionId ||
                        selectedBg?.publishedVersionId ||
                        undefined
                      : undefined,
                  }))
                }
                disabled={!config.backgroundAssetId}
              />
              <span>Pin to current published version</span>
            </label>

            {config.pinnedToVersion && selectedBg && (
              <div className={styles.helper}>
                Pinned version: <code>{pinnedVersionId}</code>
              </div>
            )}

            {selectedBg && (
              <div className={styles.preview}>
                <div className={styles.previewMeta}>
                  <strong>{selectedBg.title}</strong>
                  <span>
                    {selectedBg.width}×{selectedBg.height}
                  </span>
                </div>
                <img src={selectedBg.publishedUrl} alt={selectedBg.title} />
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
