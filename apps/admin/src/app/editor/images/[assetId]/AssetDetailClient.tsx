'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';
import Link from 'next/link';

type Asset = {
  assetId: string;
  title: string;
  type: 'background' | 'sprite' | 'splash' | 'ui';
  width: number;
  height: number;
  currentDraftVersionId?: string;
  currentPublishedVersionId?: string;
  updatedAt: string;
  tags?: string[];
};

type Version = {
  versionId: string;
  assetId: string;
  state: 'Draft' | 'Published' | 'Archived';
  storageKey: string;
  createdBy: string;
  createdAt: string;
  changeNotes?: string;
  derivedFromVersionId?: string | null;
};

const apiBase =
  process.env.ADMIN_INTERNAL_BASE_URL ||
  process.env.NEXT_PUBLIC_ADMIN_BASE_URL ||
  'http://localhost:3001';

const toAbsolute = (path: string) => new URL(path, apiBase).toString();

export function AssetDetailClient({ assetId }: { assetId: string }) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [audit, setAudit] = useState<
    { id: string; action: string; timestamp: string; actorEmail?: string | null; details?: any }[]
  >([]);
  const [usageCount, setUsageCount] = useState(0);
  const [usageRefs, setUsageRefs] = useState<{ refId: string; usageType: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  // Editable fields (local only for now)
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setActionError(null);
    try {
      const [a, v, auditRes, usageRes] = await Promise.all([
        fetch(toAbsolute(`/api/assets/${assetId}`), { cache: 'no-store' }),
        fetch(toAbsolute(`/api/assets/${assetId}/versions`), { cache: 'no-store' }),
        fetch(toAbsolute(`/api/assets/${assetId}/audit`), { cache: 'no-store' }),
        fetch(toAbsolute(`/api/assets/${assetId}/usage`), { cache: 'no-store' }),
      ]);

      const assetJson = a.ok ? await a.json() : null;
      const versionJson = v.ok ? await v.json() : null;
      const auditJson = auditRes.ok ? await auditRes.json() : null;
      const usageJson = usageRes.ok ? await usageRes.json() : null;

      if (!a.ok || !assetJson?.asset) {
        setAsset(null);
        setError('Asset not found');
      } else {
        setAsset(assetJson.asset);
        setTitle(assetJson.asset.title);
        setTags((assetJson.asset.tags ?? []).join(', '));
      }

      if (v.ok && versionJson?.versions) {
        setVersions(versionJson.versions);
      }
      if (auditRes.ok && auditJson?.entries) {
        setAudit(auditJson.entries);
      }
      if (usageRes.ok && usageJson) {
        setUsageCount(usageJson.count ?? 0);
        setUsageRefs(usageJson.usage ?? []);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    let alive = true;
    load().catch((err) => alive && setError((err as Error).message));
    return () => {
      alive = false;
    };
  }, [load]);

  const previewVersionId = useMemo(() => {
    if (!asset) return undefined;
    return asset.currentDraftVersionId ?? asset.currentPublishedVersionId;
  }, [asset]);

  const previewUrl = useMemo(() => {
    if (!previewVersionId || !asset) return '';
    const base = process.env.ASSETS_PUBLIC_BASE_URL || '';
    if (!base) return '';
    return `${base.replace(/\/$/, '')}/published/images/${asset.assetId}/${previewVersionId}.png`;
  }, [asset, previewVersionId]);

  const handleCreateDraftFromPublished = async () => {
    if (!asset?.currentPublishedVersionId) {
      setActionError('No published version available to duplicate.');
      return;
    }
    if (asset.currentDraftVersionId) {
      setActionError('A draft already exists. Publish or archive it first.');
      return;
    }
    const changeNotes = window.prompt('Change notes (optional):', '');
    if (changeNotes === null) return;

    setActionBusy('create-draft');
    setActionError(null);
    try {
      const res = await fetch(toAbsolute(`/api/assets/${assetId}/draft-from-published`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeNotes: changeNotes.trim() || undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed to create draft');
      await load();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionBusy(null);
    }
  };

  const handlePublishDraft = async () => {
    if (!asset?.currentDraftVersionId) {
      setActionError('No draft to publish.');
      return;
    }
    const changeNotes = window.prompt('Change notes (required):', '');
    if (changeNotes === null) return;
    if (!changeNotes.trim()) {
      setActionError('Change notes are required.');
      return;
    }

    setActionBusy('publish');
    setActionError(null);
    try {
      const res = await fetch(toAbsolute(`/api/assets/${asset.assetId}/publish`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: asset.assetId,
          versionId: asset.currentDraftVersionId,
          changeNotes: changeNotes.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed to publish draft');
      await load();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionBusy(null);
    }
  };

  const handleArchive = async (version: Version) => {
    if (!asset) return;
    if (asset.currentDraftVersionId === version.versionId || asset.currentPublishedVersionId === version.versionId) {
      setActionError('Cannot archive the current draft or published version.');
      return;
    }
    if (version.state === 'Archived') return;
    const confirmed = window.confirm('Archive this version? This does not delete the binary.');
    if (!confirmed) return;

    const key = `archive-${version.versionId}`;
    setActionBusy(key);
    setActionError(null);
    try {
      const res = await fetch(
        toAbsolute(`/api/assets/${asset.assetId}/versions/${version.versionId}/archive`),
        { method: 'POST' }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed to archive version');
      await load();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionBusy(null);
    }
  };

  const handleRollback = async () => {
    if (!asset) return;
    const publishedVersions = versions.filter(
      (v) => v.state === 'Published' && v.versionId !== asset.currentPublishedVersionId
    );
    if (publishedVersions.length === 0) {
      setActionError('No previous published versions to roll back to.');
      return;
    }
    const list = publishedVersions.map((v) => `${v.versionId} (${new Date(v.createdAt).toLocaleString()})`).join('\n');
    const choice = window.prompt(`Enter versionId to roll back to:\n${list}`, publishedVersions[0].versionId);
    if (!choice) return;
    const targetId = choice.trim();
    if (!publishedVersions.some((v) => v.versionId === targetId)) {
      setActionError('Invalid version selected.');
      return;
    }

    setActionBusy('rollback');
    setActionError(null);
    try {
      const res = await fetch(toAbsolute(`/api/assets/${asset.assetId}/rollback`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId: targetId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed to rollback');
      await load();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionBusy(null);
    }
  };

  if (loading) return <div className={styles.page}>Loading asset…</div>;
  if (error) return <div className={styles.page}>Error: {error}</div>;
  if (!asset) return <div className={styles.page}>Asset not found.</div>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.kicker}>Image Editor</div>
        <h1 className={styles.title}>{asset.title}</h1>
        <p className={styles.subtitle}>Asset ID: {asset.assetId}</p>
        <div className={styles.usageBadge}>
          Used by {usageCount} level{usageCount === 1 ? '' : 's'}
        </div>
      </header>

      <div className={styles.gridTwo}>
        <div className={styles.card}>
          <h3 className={styles.label}>Preview</h3>
          {previewUrl ? (
            <div className={styles.preview}>
              <Image
                src={previewUrl}
                alt={asset.title}
                width={asset.width}
                height={asset.height}
                style={{ width: '100%', height: 'auto' }}
              />
            </div>
          ) : (
            <div className={styles.placeholder}>No preview available</div>
          )}
          <div className={styles.muted}>
            Showing {asset.currentDraftVersionId ? 'draft' : 'published'} version preview
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.label}>Actions</h3>
          <div className={styles.actions}>
            <button
              className={styles.button}
              onClick={handlePublishDraft}
              disabled={actionBusy === 'publish' || !asset.currentDraftVersionId}
            >
              {actionBusy === 'publish' ? 'Publishing…' : 'Publish draft'}
            </button>
            <button
              className={`${styles.button} ${styles.buttonSecondary}`}
              onClick={handleRollback}
              disabled={actionBusy === 'rollback'}
            >
              {actionBusy === 'rollback' ? 'Rolling back…' : 'Rollback to previous published'}
            </button>
            {asset.currentDraftVersionId ? (
              <Link href={`/editor/images/${asset.assetId}/edit`} className={`${styles.button} ${styles.buttonSecondary}`}>
                Edit draft
              </Link>
            ) : (
              <button className={`${styles.button} ${styles.buttonSecondary}`} disabled>
                Edit draft (requires draft)
              </button>
            )}
            <button
              className={`${styles.button} ${styles.buttonSecondary}`}
              onClick={handleCreateDraftFromPublished}
              disabled={
                actionBusy === 'create-draft' ||
                !asset.currentPublishedVersionId ||
                Boolean(asset.currentDraftVersionId)
              }
            >
              {actionBusy === 'create-draft' ? 'Creating draft…' : 'Create new draft from published'}
            </button>
            <button className={`${styles.button} ${styles.buttonSecondary}`} disabled>
              Archive version (select below)
            </button>
            {actionError ? <div className={styles.muted}>Error: {actionError}</div> : null}
          </div>
        </div>
      </div>

      <div className={styles.gridSingle}>
        <div className={styles.card}>
          <h3 className={styles.label}>Metadata</h3>
          <div className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Title</label>
              <input
                className={styles.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Tags (comma separated)</label>
              <input
                className={styles.input}
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="hero, night, neon"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Type</label>
              <input className={styles.input} value={asset.type} readOnly />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Dimensions</label>
              <div className={styles.value}>
                {asset.width} × {asset.height}
              </div>
            </div>
            <div className={styles.muted}>Editing and saving will be wired up in a later step.</div>
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.label}>Versions</h3>
          {versions.length === 0 ? (
            <div className={styles.placeholder}>No versions yet.</div>
          ) : (
            <table className={styles.versions}>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>State</th>
                  <th>Created</th>
                  <th>Created By</th>
                  <th>Notes</th>
                  <th>Derived From</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.versionId}>
                    <td>{v.versionId}</td>
                    <td>{v.state}</td>
                    <td>{new Date(v.createdAt).toLocaleString()}</td>
                    <td>{v.createdBy}</td>
                    <td>{v.changeNotes ?? '—'}</td>
                    <td>{v.derivedFromVersionId ?? '—'}</td>
                    <td>
                      <button
                        className={`${styles.button} ${styles.buttonSecondary}`}
                        disabled={
                          v.state === 'Archived' ||
                          actionBusy === `archive-${v.versionId}` ||
                          asset.currentDraftVersionId === v.versionId ||
                          asset.currentPublishedVersionId === v.versionId
                        }
                        onClick={() => handleArchive(v)}
                      >
                        {actionBusy === `archive-${v.versionId}` ? 'Archiving…' : 'Archive'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.placeholder}>“Image editing coming soon”</div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.label}>Recent Activity</h3>
          {audit.length === 0 ? (
            <div className={styles.placeholder}>No recent activity.</div>
          ) : (
            <table className={styles.versions}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((entry) => (
                  <tr key={entry.id}>
                    <td>{new Date(entry.timestamp).toLocaleString()}</td>
                    <td>{entry.action}</td>
                    <td>{entry.actorEmail ?? '—'}</td>
                    <td>
                      {entry.details
                        ? JSON.stringify(entry.details)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
