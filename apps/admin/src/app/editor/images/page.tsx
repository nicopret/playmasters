'use client';

import { useEffect, useState } from 'react';
import styles from './page.module.css';

type AssetRow = {
  assetId: string;
  title: string;
  type: 'background' | 'sprite' | 'splash' | 'ui';
  currentDraftVersionId?: string;
  currentPublishedVersionId?: string;
  updatedAt: string;
};

const statusLabel = (asset: AssetRow) => {
  const hasDraft = Boolean(asset.currentDraftVersionId);
  const hasPub = Boolean(asset.currentPublishedVersionId);
  if (hasDraft && hasPub) return { label: 'Draft + Published', className: styles.badgeBoth };
  if (hasPub) return { label: 'Published', className: styles.badgePublished };
  if (hasDraft) return { label: 'Draft', className: styles.badgeDraft };
  return { label: 'Unknown', className: styles.badge };
};

const TYPES: AssetRow['type'][] = ['background', 'sprite', 'splash', 'ui'];
type StatusFilter = 'any' | 'draft' | 'published' | 'both';

export default function EditorImagesListPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [typeFilter, setTypeFilter] = useState<AssetRow['type'] | 'any'>('any');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('any');
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/assets', { cache: 'no-store' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const json = await res.json();
        if (alive) {
          setAssets(json.assets ?? []);
          const ids: string[] = (json.assets ?? []).map((a: AssetRow) => a.assetId);
          const usageEntries = await Promise.all(
            ids.map(async (id: string) => {
              try {
                const u = await fetch(`/api/assets/${id}/usage`, { cache: 'no-store' });
                if (!u.ok) return [id, 0] as const;
                const j = await u.json();
                return [id, j.count ?? 0] as const;
              } catch {
                return [id, 0] as const;
              }
            })
          );
          if (alive) setUsageCounts(Object.fromEntries(usageEntries));
        }
      } catch (err) {
        if (alive) setError((err as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = assets.filter((a) => {
    const typeOk = typeFilter === 'any' || a.type === typeFilter;
    const hasDraft = Boolean(a.currentDraftVersionId);
    const hasPub = Boolean(a.currentPublishedVersionId);
    const statusOk =
      statusFilter === 'any' ||
      (statusFilter === 'draft' && hasDraft && !hasPub) ||
      (statusFilter === 'published' && !hasDraft && hasPub) ||
      (statusFilter === 'both' && hasDraft && hasPub);
    return typeOk && statusOk;
  });

  const rows = filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.kicker}>Image Editor</div>
        <h1 className={styles.title}>Assets</h1>
        <p className={styles.subtitle}>Browse uploaded assets and open details.</p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <div>
            <span className={styles.kicker}>Type</span>
            <div className={styles.filters}>
              <button
                className={`${styles.chip} ${typeFilter === 'any' ? styles.chipActive : ''}`}
                onClick={() => setTypeFilter('any')}
                type="button"
              >
                All
              </button>
              {TYPES.map((t) => (
                <button
                  key={t}
                  className={`${styles.chip} ${typeFilter === t ? styles.chipActive : ''}`}
                  onClick={() => setTypeFilter(t)}
                  type="button"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className={styles.kicker}>Status</span>
            <div className={styles.filters}>
              {(['any', 'draft', 'published', 'both'] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  className={`${styles.chip} ${statusFilter === s ? styles.chipActive : ''}`}
                  onClick={() => setStatusFilter(s)}
                  type="button"
                >
                  {s === 'any'
                    ? 'All'
                    : s === 'draft'
                      ? 'Draft only'
                      : s === 'published'
                        ? 'Published only'
                        : 'Draft + Published'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <a className={styles.badgePublished} href="/editor/images/new">
          New Image
        </a>
      </div>

      {loading ? (
        <div className={styles.empty}>Loading assets…</div>
      ) : error ? (
        <div className={styles.empty}>Error: {error}</div>
      ) : rows.length === 0 ? (
        <div className={styles.empty}>No assets yet.</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Updated</th>
              <th>Usage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((asset) => {
              const status = statusLabel(asset);
              return (
                <tr
                  key={asset.assetId}
                  onClick={() => (window.location.href = `/editor/images/${asset.assetId}`)}
                >
                  <td>{asset.title}</td>
                  <td>{asset.type}</td>
                  <td>
                    <span className={`${styles.badge} ${status.className}`}>{status.label}</span>
                  </td>
                  <td>{new Date(asset.updatedAt).toLocaleString()}</td>
                  <td>{usageCounts[asset.assetId] ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
