'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import styles from './page.module.css';

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
  const [config, setConfig] = useState<LevelConfig>({
    gameId,
    levelId,
    waves: [],
  });
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
          const cfgData = cfgJson.config ?? { gameId, levelId, waves: [] };
          setConfig({
            ...cfgData,
            waves: Array.isArray(cfgData.waves) ? cfgData.waves : [],
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

  async function onSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/games/${gameId}/levels/${levelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backgroundAssetId: config.backgroundAssetId,
          backgroundVersionId: config.pinnedToVersion
            ? (config.backgroundVersionId ?? selectedBg?.publishedVersionId)
            : undefined,
          pinToVersion: config.pinnedToVersion,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Save failed');
      }
      const j = await res.json();
      setConfig(j.config);
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
          disabled={saving || loading || !!layoutError || !!wavesError}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </header>

      {error && <div className={styles.error}>Error: {error}</div>}
      {savedAt && <div className={styles.success}>Saved at {savedAt}</div>}

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
