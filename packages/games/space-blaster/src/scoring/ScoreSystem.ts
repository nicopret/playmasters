import type { ComboTierV1 } from '@playmasters/types';
import type { RunContext } from '../runtime';
import { RUN_EVENT, type RunEventBus } from '../run';
import { createInitialScoreState, type ScoreState } from './ScoreState';

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const computeLevelMultiplier = (params: {
  levelNumber: number;
  base: number;
  perLevel: number;
  max: number;
}): number => {
  const level = Math.max(1, Math.floor(params.levelNumber));
  const raw = params.base + params.perLevel * (level - 1);
  return clamp(raw, 0, params.max);
};

export const selectHighestComboTier = (
  tiers: ComboTierV1[],
  comboCount: number,
): ComboTierV1 | null => {
  if (comboCount <= 0 || tiers.length === 0) return null;
  let selected: ComboTierV1 | null = null;
  for (const tier of tiers) {
    if (comboCount >= tier.minCount) {
      selected = tier;
    } else {
      break;
    }
  }
  return selected;
};

export const computeComboTierIndex = (
  tiers: ComboTierV1[],
  comboCount: number,
): number | null => {
  if (comboCount <= 0 || tiers.length === 0) return null;
  let selectedIndex: number | null = null;
  for (let i = 0; i < tiers.length; i += 1) {
    if (comboCount >= tiers[i].minCount) {
      selectedIndex = i;
    } else {
      break;
    }
  }
  return selectedIndex;
};

type ScoreSystemOptions = {
  ctx: RunContext;
  bus: RunEventBus;
  getLevelNumber: () => number;
};

export class ScoreSystem {
  private state: ScoreState = createInitialScoreState();
  private readonly getLevelNumber: ScoreSystemOptions['getLevelNumber'];
  private readonly scoreByEnemyId = new Map<string, number>();
  private readonly fallbackEnemyScore = new Map<string, number>();
  private readonly comboEnabled: boolean;
  private readonly resetOnPlayerHit: boolean;
  private readonly comboWindowMs: number;
  private readonly comboTiers: ComboTierV1[];
  private readonly levelMultiplierBase: number;
  private readonly levelMultiplierPerLevel: number;
  private readonly levelMultiplierMax: number;
  private readonly unsubscribeFns: Array<() => void> = [];

  constructor(options: ScoreSystemOptions) {
    this.getLevelNumber = options.getLevelNumber;
    this.comboEnabled = options.ctx.resolvedConfig.scoreConfig.combo.enabled;
    this.resetOnPlayerHit =
      options.ctx.resolvedConfig.scoreConfig.combo.resetOnPlayerHit;
    this.comboWindowMs = options.ctx.resolvedConfig.scoreConfig.combo.windowMs;
    this.comboTiers = [
      ...options.ctx.resolvedConfig.scoreConfig.combo.tiers,
    ].sort((a, b) => a.minCount - b.minCount);
    this.levelMultiplierBase =
      options.ctx.resolvedConfig.scoreConfig.levelScoreMultiplier.base;
    this.levelMultiplierPerLevel =
      options.ctx.resolvedConfig.scoreConfig.levelScoreMultiplier.perLevel;
    this.levelMultiplierMax =
      options.ctx.resolvedConfig.scoreConfig.levelScoreMultiplier.max;

    for (const entry of options.ctx.resolvedConfig.scoreConfig
      .baseEnemyScores) {
      this.scoreByEnemyId.set(entry.enemyId, entry.score);
    }
    for (const enemy of options.ctx.resolvedConfig.enemyCatalog.entries) {
      this.fallbackEnemyScore.set(enemy.enemyId, enemy.baseScore ?? 0);
    }

    this.unsubscribeFns.push(
      options.bus.on(RUN_EVENT.PLAYER_SHOT_FIRED, () => {
        this.onShotFired();
      }),
      options.bus.on(RUN_EVENT.ENEMY_KILLED, ({ enemyId, nowMs }) => {
        this.onEnemyKilled(enemyId, nowMs);
      }),
      options.bus.on(RUN_EVENT.PLAYER_HIT, ({ nowMs }) => {
        this.onPlayerHit(nowMs);
      }),
    );
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribeFns) {
      unsubscribe();
    }
    this.unsubscribeFns.length = 0;
  }

  getState(): Readonly<ScoreState> {
    return this.state;
  }

  resetForNewRun(): void {
    this.state = createInitialScoreState();
  }

  onShotFired(): void {
    this.state.shotsFired += 1;
  }

  onEnemyKilled(enemyId: string, nowMs: number): void {
    if (!Number.isFinite(nowMs) || nowMs < 0) return;
    this.resetComboIfExpired(nowMs);

    const levelMultiplier = computeLevelMultiplier({
      levelNumber: this.getLevelNumber(),
      base: this.levelMultiplierBase,
      perLevel: this.levelMultiplierPerLevel,
      max: this.levelMultiplierMax,
    });
    const baseEnemyScore = this.resolveBaseEnemyScore(enemyId);
    const killPointsBase = Math.round(baseEnemyScore * levelMultiplier);

    const comboCount = this.computeNextComboCount();
    this.state.comboCount = comboCount;
    this.state.comboExpiresAtMs =
      this.comboEnabled && this.comboWindowMs > 0
        ? nowMs + this.comboWindowMs
        : null;

    const tierIndex =
      this.comboEnabled && this.comboWindowMs > 0
        ? computeComboTierIndex(this.comboTiers, comboCount)
        : null;
    const tier = tierIndex !== null ? this.comboTiers[tierIndex] : null;
    const tierMultiplier = tier?.multiplier ?? 1;
    const killPointsFromMultiplier = Math.round(
      killPointsBase * tierMultiplier,
    );
    const tierBonusAwarded = this.computeTierEntryBonus(tierIndex, comboCount);
    const killPointsFinal = killPointsFromMultiplier + tierBonusAwarded;

    this.state.score += killPointsFinal;
    this.state.breakdownTotals.kills += 1;
    this.state.breakdownTotals.baseKillPoints += killPointsBase;
    this.state.breakdownTotals.comboBonusPoints +=
      killPointsFromMultiplier - killPointsBase;
    this.state.breakdownTotals.tierBonusesAwardedTotal += tierBonusAwarded;
    this.state.lastKillAtMs = nowMs;

    const existing = this.state.perEnemy[enemyId] ?? { kills: 0, points: 0 };
    this.state.perEnemy[enemyId] = {
      kills: existing.kills + 1,
      points: existing.points + killPointsFinal,
    };
  }

  onPlayerHit(nowMs: number): void {
    if (!Number.isFinite(nowMs) || nowMs < 0) return;
    if (!this.resetOnPlayerHit) return;
    this.resetComboState('PLAYER_HIT');
  }

  private computeNextComboCount(): number {
    if (!this.comboEnabled || this.comboWindowMs <= 0) return 0;
    if (this.state.comboCount > 0 && this.state.comboExpiresAtMs !== null) {
      return this.state.comboCount + 1;
    }
    return 1;
  }

  private computeTierEntryBonus(
    newTierIndex: number | null,
    comboCount: number,
  ): number {
    if (newTierIndex === null) {
      this.state.currentTierIndex = null;
      return 0;
    }

    const enteredNewTier =
      this.state.currentTierIndex === null ||
      newTierIndex > this.state.currentTierIndex;
    this.state.currentTierIndex = newTierIndex;

    if (!enteredNewTier) {
      return 0;
    }

    this.state.lastTierReachedAtCount = comboCount;
    return this.comboTiers[newTierIndex].tierBonus ?? 0;
  }

  private resetComboIfExpired(nowMs: number): void {
    if (!this.comboEnabled || this.comboWindowMs <= 0) return;
    if (this.state.comboExpiresAtMs === null || this.state.comboCount <= 0) {
      return;
    }
    if (nowMs > this.state.comboExpiresAtMs) {
      this.resetComboState('EXPIRED');
    }
  }

  private resetComboState(reason: 'EXPIRED' | 'PLAYER_HIT' | 'MANUAL'): void {
    this.state.comboCount = 0;
    this.state.comboExpiresAtMs = null;
    this.state.currentTierIndex = null;
    this.state.lastTierReachedAtCount = 0;
    this.state.lastResetReason = reason;
  }

  private resolveBaseEnemyScore(enemyId: string): number {
    const fromScoreConfig = this.scoreByEnemyId.get(enemyId);
    if (typeof fromScoreConfig === 'number') {
      return fromScoreConfig;
    }
    return this.fallbackEnemyScore.get(enemyId) ?? 0;
  }
}
