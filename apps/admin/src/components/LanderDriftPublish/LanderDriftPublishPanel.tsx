'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import styles from './LanderDriftPublishPanel.module.css';

type StatusResponse = {
  status: {
    ship: {
      hasDraft: boolean;
      hasPublished: boolean;
      currentDraftVersionId?: string;
      currentPublishedVersionId?: string;
      lastPublishedAt?: string;
    };
    config: {
      hasDraft: boolean;
      hasPublished: boolean;
      currentDraftVersionId?: string;
      currentPublishedVersionId?: string;
    };
    readiness: {
      state:
        | 'ready'
        | 'missing_ship_asset'
        | 'missing_config'
        | 'validation_failed';
      message: string;
      validationIssues: Array<{ path: string; message: string }>;
    };
  };
  latest?: {
    publishedAt?: string;
    publishedAssetVersionId?: string;
    publishedConfigVersionId?: string;
  };
};

const fallbackStatus: StatusResponse = {
  status: {
    ship: { hasDraft: false, hasPublished: false },
    config: { hasDraft: false, hasPublished: false },
    readiness: {
      state: 'missing_ship_asset',
      message: 'Missing ship asset',
      validationIssues: [],
    },
  },
};

export default function LanderDriftPublishPanel() {
  const [data, setData] = useState<StatusResponse>(fallbackStatus);
  const [loading, setLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [changeNotes, setChangeNotes] = useState('');

  const canPublish = data.status.readiness.state === 'ready';

  const loadStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/games/lander-drift/status', {
        cache: 'no-store',
      });
      const json = (await res.json().catch(() => ({}))) as StatusResponse & {
        error?: string;
      };
      if (!res.ok)
        throw new Error(json.error ?? 'Failed to load publish status');
      setData(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const readinessLabel = useMemo(() => {
    if (canPublish) return 'Ready to publish';
    if (data.status.readiness.state === 'missing_ship_asset')
      return 'Missing ship asset';
    if (data.status.readiness.state === 'missing_config')
      return 'Missing config';
    return 'Validation failed';
  }, [canPublish, data.status.readiness.state]);

  const handlePublish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPublishing(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/games/lander-drift/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changeNotes: changeNotes.trim() || undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: Array<{ path: string; message: string }>;
        publishedAt?: string;
      };
      if (!res.ok) {
        if (Array.isArray(json.details) && json.details.length > 0) {
          throw new Error(
            `${json.error ?? 'publish_failed'}: ${json.details
              .map((d) => `${d.path} ${d.message}`)
              .join(', ')}`,
          );
        }
        throw new Error(json.error ?? 'publish_failed');
      }
      setSuccess(
        `Published successfully at ${new Date(json.publishedAt ?? Date.now()).toLocaleString()}.`,
      );
      setIsConfirmOpen(false);
      setChangeNotes('');
      await loadStatus();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <section className={styles.panel}>
      <h2 className={styles.heading}>Publish to Web</h2>
      <p className={styles.meta}>
        Promote the current Lunar Drift draft asset + config for the public web
        game.
      </p>

      {loading ? (
        <p className={styles.meta}>Loading publish status...</p>
      ) : null}
      {success ? <p className={styles.success}>{success}</p> : null}
      {error ? <p className={styles.error}>Error: {error}</p> : null}

      <div className={styles.grid}>
        <div>
          <h3 className={styles.subHeading}>Ship</h3>
          <p>Draft: {data.status.ship.currentDraftVersionId ?? 'None'}</p>
          <p>
            Published: {data.status.ship.currentPublishedVersionId ?? 'None'}
          </p>
        </div>
        <div>
          <h3 className={styles.subHeading}>Config</h3>
          <p>Draft: {data.status.config.currentDraftVersionId ?? 'None'}</p>
          <p>
            Published: {data.status.config.currentPublishedVersionId ?? 'None'}
          </p>
        </div>
      </div>

      <p className={styles.readiness}>{readinessLabel}</p>
      {data.status.ship.lastPublishedAt ? (
        <p className={styles.meta}>
          Last published:{' '}
          {new Date(data.status.ship.lastPublishedAt).toLocaleString()}
        </p>
      ) : null}

      {data.status.readiness.validationIssues.length > 0 ? (
        <ul className={styles.issues}>
          {data.status.readiness.validationIssues.map((issue, idx) => (
            <li key={`${issue.path}-${idx}`}>
              {issue.path}: {issue.message}
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        className={styles.publishButton}
        disabled={!canPublish || isPublishing}
        onClick={() => setIsConfirmOpen(true)}
      >
        {isPublishing ? 'Publishing...' : 'Publish'}
      </button>

      {isConfirmOpen ? (
        <div
          className={styles.modalOverlay}
          role="presentation"
          onClick={() => setIsConfirmOpen(false)}
          aria-hidden="true"
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-lunar-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="publish-lunar-title" className={styles.modalTitle}>
              Publish Lunar Drift?
            </h3>
            <p className={styles.meta}>
              This will make the current draft ship asset and config available
              to the web frontend.
            </p>
            <form
              className={styles.form}
              onSubmit={(event) => void handlePublish(event)}
            >
              <label className={styles.field}>
                <span>Change notes</span>
                <textarea
                  value={changeNotes}
                  onChange={(event) => setChangeNotes(event.target.value)}
                  rows={4}
                  placeholder="Optional publish notes"
                />
              </label>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setIsConfirmOpen(false)}
                  disabled={isPublishing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.publishButton}
                  disabled={isPublishing}
                >
                  {isPublishing ? 'Publishing...' : 'Confirm Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
