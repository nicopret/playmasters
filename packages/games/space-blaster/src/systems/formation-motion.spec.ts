import type { FormationLayoutEntryV1 } from '@playmasters/types';
import {
  computeRampTargetSpeed,
  computeExtentsFromOffsets,
  computeSlotLocalOffsets,
  computeWorldPositions,
  easeToward,
  stepFormation,
  type FormationState,
} from './formation-motion';

const layout: FormationLayoutEntryV1 = {
  layoutId: 'layout-test',
  rows: 2,
  columns: 3,
  spacing: { x: 20, y: 12 },
  compact: false,
};

describe('formation-motion', () => {
  it('keeps world positions aligned to slot offsets across variable dt', () => {
    const offsets = computeSlotLocalOffsets(layout, 6);
    let state: FormationState = { originX: 50, originY: 30, direction: 1 };
    const extents = computeExtentsFromOffsets(offsets, 10);
    const dtSeries = [16, 33, 16, 33, 16, 16, 33, 16];

    for (const dtMs of dtSeries) {
      state = stepFormation({
        state,
        dtMs,
        speedPxPerSecond: 40,
        descendStep: 12,
        minBoundX: 0,
        maxBoundX: 200,
        extents,
      }).state;

      const poses = computeWorldPositions(state, offsets);
      for (const pose of poses) {
        expect(pose.worldX).toBeCloseTo(state.originX + pose.localX, 8);
        expect(pose.worldY).toBeCloseTo(state.originY + pose.localY, 8);
      }
    }
  });

  it('reverses, descends, and clamps at right bound', () => {
    const offsets = computeSlotLocalOffsets(layout, 6);
    const extents = computeExtentsFromOffsets(offsets, 5);
    const result = stepFormation({
      state: { originX: 70, originY: 20, direction: 1 },
      dtMs: 1000,
      speedPxPerSecond: 40,
      descendStep: 8,
      minBoundX: 0,
      maxBoundX: 100,
      extents,
    });

    expect(result.reversed).toBe(true);
    expect(result.state.direction).toBe(-1);
    expect(result.state.originY).toBe(28);
    const rightExtent = result.state.originX + extents.maxLocalX + extents.halfEnemyWidth;
    expect(rightExtent).toBeCloseTo(100, 8);
  });

  it('reverses, descends, and clamps at left bound', () => {
    const offsets = computeSlotLocalOffsets(layout, 6);
    const extents = computeExtentsFromOffsets(offsets, 5);
    const result = stepFormation({
      state: { originX: 30, originY: 20, direction: -1 },
      dtMs: 1000,
      speedPxPerSecond: 40,
      descendStep: 8,
      minBoundX: 0,
      maxBoundX: 100,
      extents,
    });

    expect(result.reversed).toBe(true);
    expect(result.state.direction).toBe(1);
    expect(result.state.originY).toBe(28);
    const leftExtent = result.state.originX + extents.minLocalX - extents.halfEnemyWidth;
    expect(leftExtent).toBeCloseTo(0, 8);
  });

  it('handles dt spikes with a single deterministic boundary reversal', () => {
    const offsets = computeSlotLocalOffsets(layout, 6);
    const extents = computeExtentsFromOffsets(offsets, 5);
    const result = stepFormation({
      state: { originX: 70, originY: 20, direction: 1 },
      dtMs: 3000,
      speedPxPerSecond: 40,
      descendStep: 8,
      minBoundX: 0,
      maxBoundX: 100,
      extents,
    });

    expect(result.reversed).toBe(true);
    expect(result.state.direction).toBe(-1);
    const rightExtent = result.state.originX + extents.maxLocalX + extents.halfEnemyWidth;
    expect(rightExtent).toBeCloseTo(100, 8);
  });

  it('computes monotonic ramp target speed as enemies die', () => {
    const aliveSeries = [20, 10, 5, 1];
    const targets = aliveSeries.map((aliveEnemies) =>
      computeRampTargetSpeed({
        baseSpeed: 100,
        initialEnemies: 20,
        aliveEnemies,
        ramp: {
          maxMultiplier: 2,
          exponent: 1.25,
          minAliveForRamp: 1,
        },
      }),
    );

    expect(targets[0]).toBeCloseTo(100, 8);
    expect(targets[1]).toBeGreaterThanOrEqual(targets[0]);
    expect(targets[2]).toBeGreaterThanOrEqual(targets[1]);
    expect(targets[3]).toBeGreaterThanOrEqual(targets[2]);
    expect(targets[3]).toBeLessThanOrEqual(200);
  });

  it('smoothes speed similarly across variable dt steps', () => {
    const target = 180;
    let speed16 = 100;
    let speed33 = 100;

    for (let idx = 0; idx < 60; idx += 1) {
      speed16 = easeToward({
        current: speed16,
        target,
        dtMs: 16,
        smoothingPerSecond: 7,
      });
    }
    for (let idx = 0; idx < 30; idx += 1) {
      speed33 = easeToward({
        current: speed33,
        target,
        dtMs: 33,
        smoothingPerSecond: 7,
      });
    }

    expect(Math.abs(speed16 - speed33)).toBeLessThan(0.05);
    expect(speed16).toBeGreaterThan(100);
    expect(speed33).toBeGreaterThan(100);
  });
});
