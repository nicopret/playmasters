'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AssetCard, { LunarDriftAssetDraft, PhysicsValues } from './AssetCard';
import styles from './LunarDriftAssetsPage.module.css';
import type { LanderDriftConfigV1 } from '@playmasters/types';

const defaultPhysics: PhysicsValues = {
  mass: 1,
  thrust: 20,
  rotationSpeed: 4,
  damping: 0.08,
};

export default function LunarDriftAssetsPage() {
  const [playerShipAsset, setPlayerShipAsset] =
    useState<LunarDriftAssetDraft | null>(null);
  const [otherAssets, setOtherAssets] = useState<LunarDriftAssetDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (playerShipAsset?.imageUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(playerShipAsset.imageUrl);
      }
      otherAssets.forEach((asset) => {
        if (asset.imageUrl.startsWith('blob:')) {
          URL.revokeObjectURL(asset.imageUrl);
        }
      });
    };
  }, [otherAssets, playerShipAsset]);

  useEffect(() => {
    let cancelled = false;
    const loadPersistedDraft = async () => {
      setError(null);
      try {
        const [shipRes, statusRes] = await Promise.all([
          fetch('/api/admin/games/lander-drift/draft/ship', {
            cache: 'no-store',
          }),
          fetch('/api/admin/games/lander-drift/status', {
            cache: 'no-store',
          }),
        ]);
        const shipJson = (await shipRes.json().catch(() => ({}))) as {
          draft?: {
            draftName?: string;
            fileName?: string;
            imageUrl?: string;
          } | null;
        };
        const statusJson = (await statusRes.json().catch(() => ({}))) as {
          status?: {
            draftConfig?: {
              ship?: {
                physics?: PhysicsValues;
              };
            };
          };
        };
        if (!shipRes.ok) {
          throw new Error('Failed to load saved ship draft');
        }
        const draft = shipJson.draft;
        if (!draft?.imageUrl || cancelled) return;
        const physics = statusJson.status?.draftConfig?.ship?.physics;
        setPlayerShipAsset({
          id: 'player-ship',
          name: draft.draftName ?? 'Player Ship',
          fileName: draft.fileName ?? 'draft.png',
          imageUrl: draft.imageUrl,
          physics:
            physics &&
            typeof physics.mass === 'number' &&
            typeof physics.thrust === 'number' &&
            typeof physics.rotationSpeed === 'number' &&
            typeof physics.damping === 'number'
              ? physics
              : defaultPhysics,
        });
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
        }
      }
    };
    void loadPersistedDraft();
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedOtherAssets = useMemo(
    () => [...otherAssets].sort((a, b) => a.name.localeCompare(b.name)),
    [otherAssets],
  );

  const toConfig = (physics: PhysicsValues): LanderDriftConfigV1 => ({
    schemaVersion: 'lander-drift.config.v1',
    gameId: 'lander-drift',
    ship: {
      assetId: 'player-ship',
      publishedUrl: '',
      physics,
    },
    landing: {
      safeVerticalSpeed: 2.2,
      maxTiltDegrees: 16,
      padSnapDistance: 12,
    },
    fuel: {
      maxFuel: 100,
      burnRate: 10,
      idleDrainRate: 0.3,
      warningThreshold: 20,
    },
    terrain: {
      degradePerLanding: 2,
      degradePerCrash: 8,
    },
    audio: {
      thrusterFeedback: 'sfx.player.fire',
      landingFeedback: 'sfx.waveClear',
      crashFeedback: 'sfx.explosion.large',
      rescueAndDeliveryFeedback: 'sfx.tierUp',
      fuelAwareness: 'sfx.hit',
      terrainDegradation: 'sfx.explosion.medium',
      music: 'sfx.enemy.fire',
    },
  });

  const persistConfigDraft = async (physics: PhysicsValues) => {
    const res = await fetch('/api/admin/games/lander-drift/draft/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: toConfig(physics),
        changeNotes: 'Updated from Lunar Drift assets editor',
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error ?? 'Failed to save config draft');
    }
  };

  const createPlayerShipAsset = async (assetName: string, file: File) => {
    if (playerShipAsset?.imageUrl) {
      URL.revokeObjectURL(playerShipAsset.imageUrl);
    }
    const imageUrl = URL.createObjectURL(file);
    const nextAsset = {
      id: 'player-ship',
      name: assetName,
      imageUrl,
      fileName: file.name,
      physics: defaultPhysics,
    } satisfies LunarDriftAssetDraft;
    setPlayerShipAsset(nextAsset);

    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('draftName', assetName);
      form.set('physics', JSON.stringify(defaultPhysics));
      const shipRes = await fetch('/api/admin/games/lander-drift/draft/ship', {
        method: 'POST',
        body: form,
      });
      const shipJson = await shipRes.json().catch(() => ({}));
      if (!shipRes.ok) {
        throw new Error(shipJson.error ?? 'Failed to save ship draft');
      }
      await persistConfigDraft(defaultPhysics);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const savePlayerShipPhysics = async (physics: PhysicsValues) => {
    setPlayerShipAsset((current) =>
      current
        ? {
            ...current,
            physics,
          }
        : current,
    );

    setSaving(true);
    setError(null);
    try {
      await persistConfigDraft(physics);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const loadSampleAsset = () => {
    if (playerShipAsset) return;
    setPlayerShipAsset({
      id: 'player-ship',
      name: 'Sample Ship',
      imageUrl:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='420' height='240'%3E%3Crect width='100%25' height='100%25' fill='%23eef2ff'/%3E%3Cpolygon points='210,28 278,182 210,148 142,182' fill='%232563eb'/%3E%3Ccircle cx='210' cy='178' r='16' fill='%231d4ed8'/%3E%3C/svg%3E",
      fileName: 'sample-ship.svg',
      physics: defaultPhysics,
    });
  };

  return (
    <div className={styles.layout}>
      <p className={styles.meta}>
        Manage image assets and placeholder physics values.
      </p>
      {saving ? <p className={styles.info}>Saving draft...</p> : null}
      {error ? <p className={styles.error}>Error: {error}</p> : null}
      <div className={styles.contentColumn}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Player Ship</h2>
          <AssetCard
            slotLabel="Primary"
            asset={playerShipAsset}
            fixedUploadName="Player Ship"
            onCreateAsset={(assetName, file) => {
              void createPlayerShipAsset(assetName, file);
            }}
            onSavePhysics={(physics) => {
              void savePlayerShipPhysics(physics);
            }}
            onEditImage={() => undefined}
            editImageDisabled
          />
          {process.env.NODE_ENV !== 'production' ? (
            <button
              type="button"
              className={styles.devButton}
              onClick={loadSampleAsset}
            >
              Dev: Load Sample Asset
            </button>
          ) : null}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Other Assets</h2>
          {sortedOtherAssets.length === 0 ? (
            <p className={styles.emptyCopy}>No additional assets yet.</p>
          ) : (
            <div className={styles.stack}>
              {sortedOtherAssets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  slotLabel="Secondary"
                  asset={asset}
                  onCreateAsset={() => undefined}
                  onSavePhysics={(physics) => {
                    setOtherAssets((current) =>
                      current.map((item) =>
                        item.id === asset.id
                          ? {
                              ...item,
                              physics,
                            }
                          : item,
                      ),
                    );
                  }}
                  onEditImage={() => undefined}
                  editImageDisabled
                />
              ))}
            </div>
          )}
        </section>

        <Link href="/games/lander-drift" className={styles.backLink}>
          Back to Lunar Drift
        </Link>
      </div>
    </div>
  );
}
