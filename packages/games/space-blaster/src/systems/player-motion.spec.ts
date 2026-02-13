import { integrateHorizontalMotion } from './player-motion';

const params = {
  minX: 0,
  maxX: 800,
  halfWidth: 20,
  maxSpeedPxPerSec: 260,
};

describe('integrateHorizontalMotion', () => {
  it('keeps displacement consistent across variable FPS over one second', () => {
    let state60 = { x: 300, velocityX: 0 };
    let state30 = { x: 300, velocityX: 0 };

    for (let i = 0; i < 60; i += 1) {
      state60 = integrateHorizontalMotion(state60, 1, 1000 / 60, params);
    }

    for (let i = 0; i < 30; i += 1) {
      state30 = integrateHorizontalMotion(state30, 1, 1000 / 30, params);
    }

    expect(state60.x).toBeCloseTo(state30.x, 6);
  });

  it('clamps at left and right bounds', () => {
    const left = integrateHorizontalMotion(
      { x: 25, velocityX: 0 },
      -1,
      33,
      params,
    );
    expect(left.x).toBe(params.minX + params.halfWidth);

    const right = integrateHorizontalMotion(
      { x: 775, velocityX: 0 },
      1,
      33,
      params,
    );
    expect(right.x).toBe(params.maxX - params.halfWidth);
  });

  it('holds clamp on dt spikes', () => {
    const leftSpike = integrateHorizontalMotion(
      { x: 50, velocityX: 0 },
      -1,
      200,
      params,
    );
    expect(leftSpike.x).toBe(params.minX + params.halfWidth);

    const rightSpike = integrateHorizontalMotion(
      { x: 750, velocityX: 0 },
      1,
      200,
      params,
    );
    expect(rightSpike.x).toBe(params.maxX - params.halfWidth);
  });
});
