import type { FormationLayoutEntryV1 } from '@playmasters/types';
import {
  computeExtentsFromOffsets,
  computeRampTargetSpeed,
  computeSlotLocalOffsets,
  computeWorldPositions,
  stepFormation,
  type FormationState,
} from './formation-motion';

const layout: FormationLayoutEntryV1 = {
  layoutId: 'ticket-27-layout',
  rows: 2,
  columns: 3,
  spacing: { x: 20, y: 12 },
};

describe('ticket-27 acceptance', () => {
  it('keeps enemies aligned to slot origin transform (no drift)', () => {
    const offsets = computeSlotLocalOffsets(layout, 6);
    let state: FormationState = { originX: 50, originY: 30, direction: 1 };
    const extents = computeExtentsFromOffsets(offsets, 10);

    for (const dtMs of [16, 33, 16, 33, 16]) {
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

  it('reverses and descends on edge hit', () => {
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
  });

  it('increases speed as alive count decreases', () => {
    const aliveSeries = [20, 10, 5, 1];
    const speeds = aliveSeries.map((aliveEnemies) =>
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

    expect(speeds[1]).toBeGreaterThanOrEqual(speeds[0]);
    expect(speeds[2]).toBeGreaterThanOrEqual(speeds[1]);
    expect(speeds[3]).toBeGreaterThanOrEqual(speeds[2]);
  });
});
