import {
  computeDiveStep,
  computeSineDiveStep,
  computeTrackedDiveStep,
  rotateTowardAngle,
} from './enemy-motion';

describe('enemy-motion', () => {
  it('computes straight dive displacement from speed and dt', () => {
    const next = computeDiveStep({
      position: { x: 10, y: 20 },
      speedPxPerSecond: 120,
      dtMs: 1000,
    });
    expect(next.x).toBeCloseTo(10, 8);
    expect(next.y).toBeCloseTo(140, 8);
  });

  it('keeps sine oscillation bounded by amplitude', () => {
    const amplitudePx = 24;
    let elapsedMs = 0;
    let position = { x: 100, y: 0 };
    for (let i = 0; i < 120; i += 1) {
      position = computeSineDiveStep({
        baseX: 100,
        position,
        speedPxPerSecond: 100,
        dtMs: 16,
        elapsedMs,
        amplitudePx,
        frequencyHz: 1.5,
      });
      elapsedMs += 16;
      expect(position.x).toBeGreaterThanOrEqual(100 - amplitudePx - 0.00001);
      expect(position.x).toBeLessThanOrEqual(100 + amplitudePx + 0.00001);
    }
    expect(position.y).toBeGreaterThan(0);
  });

  it('limits tracking turn by turnRate per tick', () => {
    const step = computeTrackedDiveStep({
      position: { x: 0, y: 0 },
      speedPxPerSecond: 100,
      dtMs: 100,
      currentAngleRad: Math.PI / 2,
      target: { x: 100, y: 0 },
      turnRateDegPerSecond: 45,
    });

    const maxDelta = ((45 * Math.PI) / 180) * 0.1;
    expect(Math.abs(step.appliedDeltaRad)).toBeLessThanOrEqual(maxDelta + 1e-8);
    expect(step.angleRad).not.toBeCloseTo(0, 4);
  });

  it('rotates toward desired angle gradually over multiple ticks', () => {
    let angle = Math.PI / 2;
    const targetAngle = 0;
    let firstStepAngle = angle;
    for (let i = 0; i < 10; i += 1) {
      const rotated = rotateTowardAngle({
        currentAngleRad: angle,
        targetAngleRad: targetAngle,
        maxDeltaRad: (10 * Math.PI) / 180,
      });
      expect(Math.abs(rotated.appliedDeltaRad)).toBeLessThanOrEqual(
        (10 * Math.PI) / 180 + 1e-8,
      );
      angle = rotated.nextAngleRad;
      if (i === 0) {
        firstStepAngle = angle;
      }
    }
    expect(firstStepAngle).toBeGreaterThan(1);
    expect(angle).toBeCloseTo(targetAngle, 8);
  });
});
