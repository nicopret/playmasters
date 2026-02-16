import { ParticleBudget } from './ParticleBudget';

describe('ParticleBudget', () => {
  it('enforces hard caps per burst and global active budget', () => {
    const budget = new ParticleBudget({
      maxActiveParticles: 5,
      maxParticlesPerBurst: 3,
      burstLifetimeMs: 1000,
    });

    expect(budget.reserve(10, 0)).toBe(3);
    expect(budget.getInUse()).toBe(3);
    expect(budget.reserve(10, 1)).toBe(2);
    expect(budget.getInUse()).toBe(5);
    expect(budget.reserve(1, 2)).toBe(0);
  });

  it('frees budget when bursts expire with sim clock progression', () => {
    const budget = new ParticleBudget({
      maxActiveParticles: 4,
      maxParticlesPerBurst: 4,
      burstLifetimeMs: 100,
    });

    expect(budget.reserve(4, 10)).toBe(4);
    expect(budget.getInUse()).toBe(4);

    budget.update(109);
    expect(budget.getInUse()).toBe(4);

    budget.update(110);
    expect(budget.getInUse()).toBe(0);
  });

  it('does not grow internal burst list unbounded under repeated updates', () => {
    const budget = new ParticleBudget({
      maxActiveParticles: 8,
      maxParticlesPerBurst: 2,
      burstLifetimeMs: 20,
    });

    for (let i = 0; i < 50; i += 1) {
      budget.reserve(2, i * 5);
      budget.update(i * 5);
    }

    expect(budget.getActiveBurstCount()).toBeLessThanOrEqual(8);
  });
});
