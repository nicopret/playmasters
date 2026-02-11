import { snapshotsEnabled, putSnapshots } from '../ddb';
import type { LeaderboardStore } from './store';

const SNAPSHOT_INTERVAL_MS = Number(process.env.SNAPSHOT_INTERVAL_MS ?? 10_000);

export function startSnapshotLoop(store: LeaderboardStore) {
  if (!snapshotsEnabled) {
    return () => undefined;
  }

  const timer = setInterval(async () => {
    const dirty = store.consumeDirtySnapshots().filter((s) => s.scope !== 'personal');
    if (!dirty.length) return;

    try {
      await putSnapshots(dirty);
    } catch (err) {
      console.warn('Snapshot flush failed', err);
    }
  }, SNAPSHOT_INTERVAL_MS);

  return () => clearInterval(timer);
}
