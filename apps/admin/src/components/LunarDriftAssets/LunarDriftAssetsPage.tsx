'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AssetCard, { LunarDriftAssetDraft, PhysicsValues } from './AssetCard';
import styles from './LunarDriftAssetsPage.module.css';

const defaultPhysics: PhysicsValues = {
  mass: 1,
  thrust: 20,
  rotationSpeed: 4,
  damping: 0.08,
};

export default function LunarDriftAssetsPage() {
  const [playerShipAsset, setPlayerShipAsset] = useState<LunarDriftAssetDraft | null>(
    null,
  );
  const [otherAssets, setOtherAssets] = useState<LunarDriftAssetDraft[]>([]);

  useEffect(() => {
    return () => {
      if (playerShipAsset?.imageUrl) {
        URL.revokeObjectURL(playerShipAsset.imageUrl);
      }
      otherAssets.forEach((asset) => URL.revokeObjectURL(asset.imageUrl));
    };
  }, [otherAssets, playerShipAsset]);

  const sortedOtherAssets = useMemo(
    () => [...otherAssets].sort((a, b) => a.name.localeCompare(b.name)),
    [otherAssets],
  );

  const createPlayerShipAsset = (assetName: string, file: File) => {
    if (playerShipAsset?.imageUrl) {
      URL.revokeObjectURL(playerShipAsset.imageUrl);
    }
    const imageUrl = URL.createObjectURL(file);
    setPlayerShipAsset({
      id: 'player-ship',
      name: assetName,
      imageUrl,
      fileName: file.name,
      physics: defaultPhysics,
    });
  };

  const savePlayerShipPhysics = (physics: PhysicsValues) => {
    setPlayerShipAsset((current) =>
      current
        ? {
            ...current,
            physics,
          }
        : current,
    );
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
      <p className={styles.meta}>Manage image assets and placeholder physics values.</p>
      <div className={styles.contentColumn}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Player Ship</h2>
          <AssetCard
            slotLabel="Primary"
            asset={playerShipAsset}
            onCreateAsset={createPlayerShipAsset}
            onSavePhysics={savePlayerShipPhysics}
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
