type ActiveBurst = {
  endsAtMs: number;
  count: number;
};

const clampInt = (value: number, fallback: number): number => {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
};

export type ParticleBudgetOptions = {
  maxActiveParticles: number;
  maxParticlesPerBurst: number;
  burstLifetimeMs: number;
};

export class ParticleBudget {
  private readonly maxActiveParticles: number;
  private readonly maxParticlesPerBurst: number;
  private readonly burstLifetimeMs: number;
  private bursts: ActiveBurst[] = [];
  private inUse = 0;

  constructor(options: ParticleBudgetOptions) {
    this.maxActiveParticles = clampInt(options.maxActiveParticles, 0);
    this.maxParticlesPerBurst = clampInt(options.maxParticlesPerBurst, 0);
    this.burstLifetimeMs = clampInt(options.burstLifetimeMs, 0);
  }

  reserve(requested: number, nowMs: number): number {
    this.update(nowMs);
    const requestedCount = clampInt(requested, 0);
    const available = Math.max(0, this.maxActiveParticles - this.inUse);
    const granted = Math.max(
      0,
      Math.min(requestedCount, this.maxParticlesPerBurst, available),
    );
    if (granted <= 0) {
      return 0;
    }

    this.inUse += granted;
    this.bursts.push({
      count: granted,
      endsAtMs: nowMs + this.burstLifetimeMs,
    });
    return granted;
  }

  update(nowMs: number): void {
    if (!Number.isFinite(nowMs)) {
      return;
    }
    if (this.bursts.length === 0) {
      return;
    }

    const remaining: ActiveBurst[] = [];
    for (const burst of this.bursts) {
      if (nowMs >= burst.endsAtMs) {
        this.inUse = Math.max(0, this.inUse - burst.count);
        continue;
      }
      remaining.push(burst);
    }
    this.bursts = remaining;
  }

  reset(): void {
    this.bursts = [];
    this.inUse = 0;
  }

  getInUse(): number {
    return this.inUse;
  }

  getActiveBurstCount(): number {
    return this.bursts.length;
  }
}
