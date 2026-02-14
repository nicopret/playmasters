export type PlayerHitOutcome =
  | { kind: 'ignored' }
  | { kind: 'respawn'; livesRemaining: number }
  | { kind: 'end_run'; livesRemaining: 0 };

export class PlayerLifeSystem {
  private livesRemaining: number;
  private invulnRemainingMs = 0;
  private damageLockoutRemainingMs = 0;

  constructor(
    private readonly initialLives: number,
    private readonly respawnInvulnerabilityMs: number,
    private readonly damageLockoutMs = 50,
  ) {
    this.livesRemaining = initialLives;
  }

  get lives(): number {
    return this.livesRemaining;
  }

  get invulnerable(): boolean {
    return this.invulnRemainingMs > 0;
  }

  get invulnerabilityRemainingMs(): number {
    return this.invulnRemainingMs;
  }

  reset(): void {
    this.livesRemaining = this.initialLives;
    this.invulnRemainingMs = 0;
    this.damageLockoutRemainingMs = 0;
  }

  update(simDtMs: number): void {
    this.invulnRemainingMs = Math.max(0, this.invulnRemainingMs - simDtMs);
    this.damageLockoutRemainingMs = Math.max(
      0,
      this.damageLockoutRemainingMs - simDtMs,
    );
  }

  startRespawnInvulnerability(): void {
    this.invulnRemainingMs = this.respawnInvulnerabilityMs;
    this.damageLockoutRemainingMs = this.damageLockoutMs;
  }

  onPlayerHit(): PlayerHitOutcome {
    if (this.damageLockoutRemainingMs > 0 || this.invulnerable) {
      return { kind: 'ignored' };
    }

    this.damageLockoutRemainingMs = this.damageLockoutMs;
    if (this.livesRemaining <= 0) return { kind: 'end_run', livesRemaining: 0 };

    this.livesRemaining -= 1;
    if (this.livesRemaining <= 0) {
      this.livesRemaining = 0;
      return { kind: 'end_run', livesRemaining: 0 };
    }

    this.startRespawnInvulnerability();
    return { kind: 'respawn', livesRemaining: this.livesRemaining };
  }
}
