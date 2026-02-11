import type { LeaderboardEntry, LeaderboardScope, LeaderboardState } from '@playmasters/types';

export type ScoreInput = {
  gameId: string;
  userId: string;
  displayName: string;
  countryCode?: string;
  score: number;
  achievedAt: string;
};

const DEFAULT_TOP_N = 50;
export const TOP_N = Number(process.env.TOP_N ?? DEFAULT_TOP_N);

const compareEntries = (a: LeaderboardEntry, b: LeaderboardEntry) => {
  if (a.score !== b.score) return b.score - a.score;
  return new Date(a.achievedAt).getTime() - new Date(b.achievedAt).getTime();
};

const makeLocalKey = (gameId: string, countryCode: string) => `${gameId}::${countryCode}`;

export class LeaderboardStore {
  private globalTop = new Map<string, LeaderboardEntry[]>();
  private globalUpdatedAt = new Map<string, string>();

  private localTop = new Map<string, Map<string, LeaderboardEntry[]>>();
  private localUpdatedAt = new Map<string, Map<string, string>>();

  private personalBest = new Map<string, Map<string, LeaderboardEntry>>();
  private personalUpdatedAt = new Map<string, Map<string, string>>();

  private dirtyGlobal = new Set<string>();
  private dirtyLocal = new Set<string>();

  applyScore(input: ScoreInput) {
    const { gameId, userId, displayName, countryCode, score } = input;
    const achievedAt = new Date(input.achievedAt).toISOString();

    const personalMap = this.ensurePersonalMap(gameId);
    const existingPersonal = personalMap.get(userId);

    if (existingPersonal && !this.isBetter(score, achievedAt, existingPersonal)) {
      return { changed: false };
    }

    const baseEntry: LeaderboardEntry = {
      rank: 0,
      userId,
      displayName,
      countryCode,
      score,
      achievedAt,
    };

    personalMap.set(userId, { ...baseEntry, rank: 1 });
    this.markPersonalUpdated(gameId, userId, achievedAt);
    const personalState = this.buildPersonalState(gameId, userId);

    const globalState = this.upsertLeaderboard(gameId, baseEntry);
    const localState = countryCode ? this.upsertLeaderboard(gameId, baseEntry, countryCode) : undefined;

    return {
      changed: true,
      global: globalState,
      local: localState,
      personal: personalState,
    };
  }

  getState(gameId: string, scope: LeaderboardScope, countryCode?: string, userId?: string): LeaderboardState {
    if (scope === 'global') {
      const entries = this.ensureGlobalList(gameId);
      const updatedAt = this.globalUpdatedAt.get(gameId) ?? new Date(0).toISOString();
      return this.buildState(gameId, 'global', entries, updatedAt);
    }

    if (scope === 'local') {
      const key = countryCode ?? 'ZZ';
      const entries = this.ensureLocalList(gameId, key);
      const updatedAt = this.localUpdatedAt.get(gameId)?.get(key) ?? new Date(0).toISOString();
      return this.buildState(gameId, 'local', entries, updatedAt, key);
    }

    if (!userId) {
      return this.buildState(gameId, 'personal', [], new Date(0).toISOString(), countryCode);
    }

    return this.buildPersonalState(gameId, userId);
  }

  loadSnapshot(state: LeaderboardState) {
    if (state.scope === 'global') {
      this.globalTop.set(state.gameId, this.withRanks(state.entries));
      this.globalUpdatedAt.set(state.gameId, state.updatedAt);
      return;
    }

    if (state.scope === 'local' && state.countryCode) {
      this.setLocalList(state.gameId, state.countryCode, this.withRanks(state.entries));
      this.markLocalUpdated(state.gameId, state.countryCode, state.updatedAt);
    }
  }

  consumeDirtySnapshots(): LeaderboardState[] {
    const snapshots: LeaderboardState[] = [];

    for (const gameId of this.dirtyGlobal) {
      const entries = this.ensureGlobalList(gameId);
      const updatedAt = this.globalUpdatedAt.get(gameId) ?? new Date().toISOString();
      snapshots.push(this.buildState(gameId, 'global', entries, updatedAt));
    }

    for (const key of this.dirtyLocal) {
      const [gameId, countryCode] = key.split('::');
      const entries = this.ensureLocalList(gameId, countryCode);
      const updatedAt = this.localUpdatedAt.get(gameId)?.get(countryCode) ?? new Date().toISOString();
      snapshots.push(this.buildState(gameId, 'local', entries, updatedAt, countryCode));
    }

    this.dirtyGlobal.clear();
    this.dirtyLocal.clear();

    return snapshots;
  }

  private upsertLeaderboard(gameId: string, entry: LeaderboardEntry, countryCode?: string): LeaderboardState {
    const list = countryCode ? this.ensureLocalList(gameId, countryCode) : this.ensureGlobalList(gameId);
    const filtered = list.filter((row) => row.userId !== entry.userId);
    filtered.push({ ...entry });
    filtered.sort(compareEntries);
    const trimmed = filtered.slice(0, TOP_N).map((row, index) => ({ ...row, rank: index + 1 }));

    const updatedAt = new Date().toISOString();

    if (countryCode) {
      this.setLocalList(gameId, countryCode, trimmed);
      this.markLocalUpdated(gameId, countryCode, updatedAt);
      this.dirtyLocal.add(makeLocalKey(gameId, countryCode));
      return this.buildState(gameId, 'local', trimmed, updatedAt, countryCode);
    }

    this.globalTop.set(gameId, trimmed);
    this.globalUpdatedAt.set(gameId, updatedAt);
    this.dirtyGlobal.add(gameId);
    return this.buildState(gameId, 'global', trimmed, updatedAt);
  }

  private buildPersonalState(gameId: string, userId: string): LeaderboardState {
    const entry = this.ensurePersonalMap(gameId).get(userId);
    const updatedAt = this.personalUpdatedAt.get(gameId)?.get(userId) ?? new Date().toISOString();
    const entries = entry ? [{ ...entry, rank: 1 }] : [];
    return this.buildState(gameId, 'personal', entries, updatedAt);
  }

  private isBetter(score: number, achievedAt: string, existing: LeaderboardEntry) {
    if (score > existing.score) return true;
    if (score < existing.score) return false;
    return new Date(achievedAt).getTime() < new Date(existing.achievedAt).getTime();
  }

  private buildState(
    gameId: string,
    scope: LeaderboardScope,
    entries: LeaderboardEntry[],
    updatedAt: string,
    countryCode?: string
  ): LeaderboardState {
    return {
      gameId,
      scope,
      countryCode,
      entries: this.withRanks(entries),
      updatedAt,
    };
  }

  private withRanks(entries: LeaderboardEntry[]): LeaderboardEntry[] {
    return entries.map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  private ensureGlobalList(gameId: string) {
    const existing = this.globalTop.get(gameId);
    if (existing) return existing;
    const list: LeaderboardEntry[] = [];
    this.globalTop.set(gameId, list);
    this.globalUpdatedAt.set(gameId, new Date(0).toISOString());
    return list;
  }

  private ensureLocalList(gameId: string, countryCode: string) {
    const gameMap = this.localTop.get(gameId) ?? new Map<string, LeaderboardEntry[]>();
    if (!this.localTop.has(gameId)) this.localTop.set(gameId, gameMap);

    const existing = gameMap.get(countryCode);
    if (existing) return existing;
    const list: LeaderboardEntry[] = [];
    gameMap.set(countryCode, list);
    this.markLocalUpdated(gameId, countryCode, new Date(0).toISOString());
    return list;
  }

  private setLocalList(gameId: string, countryCode: string, entries: LeaderboardEntry[]) {
    const gameMap = this.localTop.get(gameId) ?? new Map<string, LeaderboardEntry[]>();
    if (!this.localTop.has(gameId)) this.localTop.set(gameId, gameMap);
    gameMap.set(countryCode, entries);
  }

  private ensurePersonalMap(gameId: string) {
    const map = this.personalBest.get(gameId) ?? new Map<string, LeaderboardEntry>();
    if (!this.personalBest.has(gameId)) this.personalBest.set(gameId, map);
    return map;
  }

  private markLocalUpdated(gameId: string, countryCode: string, updatedAt: string) {
    const map = this.localUpdatedAt.get(gameId) ?? new Map<string, string>();
    if (!this.localUpdatedAt.has(gameId)) this.localUpdatedAt.set(gameId, map);
    map.set(countryCode, updatedAt);
  }

  private markPersonalUpdated(gameId: string, userId: string, updatedAt: string) {
    const map = this.personalUpdatedAt.get(gameId) ?? new Map<string, string>();
    if (!this.personalUpdatedAt.has(gameId)) this.personalUpdatedAt.set(gameId, map);
    map.set(userId, updatedAt);
  }
}
