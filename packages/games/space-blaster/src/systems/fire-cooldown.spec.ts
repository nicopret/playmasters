import { FireCooldown } from './fire-cooldown';

describe('FireCooldown', () => {
  it('respects cooldown under held fire with variable dt', () => {
    const cooldown = new FireCooldown(200);
    let shots60 = 0;
    let shots30 = 0;

    for (let i = 0; i < 60; i += 1) {
      if (cooldown.consume()) shots60 += 1;
      cooldown.update(1000 / 60);
    }

    const cooldownB = new FireCooldown(200);
    for (let i = 0; i < 30; i += 1) {
      if (cooldownB.consume()) shots30 += 1;
      cooldownB.update(1000 / 30);
    }

    expect(shots60).toBe(shots30);
    expect(shots60).toBe(5);
  });

  it('never emits extra shots on a dt spike', () => {
    const cooldown = new FireCooldown(200);
    expect(cooldown.consume()).toBe(true);
    expect(cooldown.consume()).toBe(false);

    cooldown.update(1000);
    expect(cooldown.consume()).toBe(true);
    expect(cooldown.consume()).toBe(false);
  });
});
