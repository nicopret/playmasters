import type { LeaderboardStore } from './store';
import { scanSnapshots, snapshotsEnabled } from '../ddb';

export async function restoreSnapshots(store: LeaderboardStore) {
  if (!snapshotsEnabled) {
    return { restored: 0 };
  }

  try {
    const snapshots = await scanSnapshots();
    snapshots.forEach((snapshot) => store.loadSnapshot(snapshot));
    return { restored: snapshots.length };
  } catch (err) {
    console.warn('Failed to restore leaderboard snapshots', err);
    return { restored: 0, error: (err as Error).message };
  }
}
