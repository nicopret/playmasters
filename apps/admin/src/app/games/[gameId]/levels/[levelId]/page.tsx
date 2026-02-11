"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

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

type LevelConfig = {
  gameId: string;
  levelId: string;
  backgroundAssetId?: string;
  backgroundVersionId?: string;
  pinnedToVersion?: boolean;
  updatedAt?: string;
};

export default function LevelConfigPage({
  params,
}: {
  params: { gameId: string; levelId: string };
}) {
  const { gameId, levelId } = params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backgrounds, setBackgrounds] = useState<BackgroundItem[]>([]);
  const [config, setConfig] = useState<LevelConfig>({
    gameId,
    levelId,
  });
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const [cfgRes, bgRes] = await Promise.all([
          fetch(`/api/games/${gameId}/levels/${levelId}`),
          fetch(`/api/catalog/backgrounds`),
        ]);
        if (!cfgRes.ok) throw new Error("Failed to load level");
        if (!bgRes.ok) throw new Error("Failed to load backgrounds");
        const cfgJson = await cfgRes.json();
        const bgJson = await bgRes.json();
        if (!cancelled) {
          setConfig(cfgJson.config ?? { gameId, levelId });
          setBackgrounds(bgJson.backgrounds ?? []);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Load failed");
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
    [backgrounds, config.backgroundAssetId]
  );

  const pinnedVersionId =
    config.pinnedToVersion && config.backgroundVersionId
      ? config.backgroundVersionId
      : selectedBg?.publishedVersionId;

  async function onSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/games/${gameId}/levels/${levelId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backgroundAssetId: config.backgroundAssetId,
          backgroundVersionId: config.pinnedToVersion
            ? config.backgroundVersionId ?? selectedBg?.publishedVersionId
            : undefined,
          pinToVersion: config.pinnedToVersion,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Save failed");
      }
      const j = await res.json();
      setConfig(j.config);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err?.message ?? "Save failed");
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
          disabled={saving || loading}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </header>

      {error && <div className={styles.error}>Error: {error}</div>}
      {savedAt && <div className={styles.success}>Saved at {savedAt}</div>}

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
                value={config.backgroundAssetId ?? ""}
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
