import type { FormationLayoutEntryV1 } from '@playmasters/types';
import {
  computeExtentsFromOffsets,
  computeSlotLocalOffsets,
  computeWorldPositions,
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
});
