import type { FormationLayoutEntryV1 } from '@playmasters/types';

export type SlotLocalOffset = {
  slotId: string;
  row: number;
  column: number;
  localX: number;
  localY: number;
};

export type FormationState = {
  originX: number;
  originY: number;
  direction: 1 | -1;
};

export type FormationExtents = {
  minLocalX: number;
  maxLocalX: number;
  halfEnemyWidth: number;
};

export type FormationStepParams = {
  state: FormationState;
  dtMs: number;
  speedPxPerSecond: number;
  descendStep: number;
  minBoundX: number;
  maxBoundX: number;
  extents: FormationExtents;
};

export type FormationStepResult = {
  state: FormationState;
  reversed: boolean;
};

export type FleetRampConfig = {
  maxMultiplier: number;
  exponent: number;
  minAliveForRamp: number;
};

export type FleetEnrageConfig = {
  threshold: number;
  speedMultiplier: number;
  timeoutMs: number;
  autoCompleteOnTimeout: boolean;
};

export type StallAggressionConfig = {
  threshold: number;
  speedMultiplier: number;
};

export const smoothstep = (value: number): number => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

export const computeRampTargetSpeed = (params: {
  baseSpeed: number;
  initialEnemies: number;
  aliveEnemies: number;
  ramp: FleetRampConfig;
}): number => {
  const initial = Math.max(1, params.initialEnemies);
  const boundedAlive = Math.max(
    params.ramp.minAliveForRamp,
    Math.min(initial, params.aliveEnemies),
  );
  const progress = 1 - boundedAlive / initial;
  const curved = Math.pow(smoothstep(progress), params.ramp.exponent);
  const multiplier = 1 + (params.ramp.maxMultiplier - 1) * curved;
  return params.baseSpeed * multiplier;
};

export const computeStallAggressionTargetSpeed = (params: {
  baseSpeed: number;
  aliveEnemies: number;
  config: StallAggressionConfig;
}): number | null => {
  if (
    params.config.threshold <= 0 ||
    params.config.speedMultiplier <= 1 ||
    params.aliveEnemies <= 0 ||
    params.aliveEnemies > params.config.threshold
  ) {
    return null;
  }
  return params.baseSpeed * params.config.speedMultiplier;
};

export const easeToward = (params: {
  current: number;
  target: number;
  dtMs: number;
  smoothingPerSecond: number;
}): number => {
  const dtSeconds = params.dtMs / 1000;
  const blend =
    1 - Math.exp(-Math.max(0, params.smoothingPerSecond) * dtSeconds);
  return params.current + (params.target - params.current) * blend;
};

export const computeSlotLocalOffsets = (
  layout: FormationLayoutEntryV1,
  requestedCount: number,
): SlotLocalOffset[] => {
  const capacity = layout.rows * layout.columns;
  const slotCount = Math.min(capacity, Math.max(0, requestedCount));
  const offsets: SlotLocalOffset[] = [];
  const yCenterOffset = ((layout.rows - 1) * layout.spacing.y) / 2;
  const compact = layout.compact === true;
  const offsetX = layout.offset?.x ?? 0;
  const offsetY = layout.offset?.y ?? 0;

  for (let index = 0; index < slotCount; index += 1) {
    const row = Math.floor(index / layout.columns);
    const indexInRow = index % layout.columns;
    const rowStartIndex = row * layout.columns;
    const remaining = slotCount - rowStartIndex;
    const rowCount = compact
      ? Math.max(1, Math.min(layout.columns, remaining))
      : layout.columns;
    const xCenterOffset = ((rowCount - 1) * layout.spacing.x) / 2;
    const localX = indexInRow * layout.spacing.x - xCenterOffset + offsetX;
    const localY = row * layout.spacing.y - yCenterOffset + offsetY;

    offsets.push({
      slotId: `${row}:${indexInRow}`,
      row,
      column: indexInRow,
      localX,
      localY,
    });
  }

  return offsets;
};

export const computeWorldPositions = (
  state: FormationState,
  offsets: SlotLocalOffset[],
): Array<SlotLocalOffset & { worldX: number; worldY: number }> =>
  offsets.map((slot) => ({
    ...slot,
    worldX: state.originX + slot.localX,
    worldY: state.originY + slot.localY,
  }));

export const computeExtentsFromOffsets = (
  offsets: SlotLocalOffset[],
  halfEnemyWidth: number,
): FormationExtents => {
  if (offsets.length === 0) {
    return { minLocalX: 0, maxLocalX: 0, halfEnemyWidth };
  }

  let minLocalX = offsets[0].localX;
  let maxLocalX = offsets[0].localX;
  for (const slot of offsets) {
    if (slot.localX < minLocalX) minLocalX = slot.localX;
    if (slot.localX > maxLocalX) maxLocalX = slot.localX;
  }

  return { minLocalX, maxLocalX, halfEnemyWidth };
};

export const stepFormation = ({
  state,
  dtMs,
  speedPxPerSecond,
  descendStep,
  minBoundX,
  maxBoundX,
  extents,
}: FormationStepParams): FormationStepResult => {
  const dtSeconds = dtMs / 1000;
  const proposedX =
    state.originX + state.direction * speedPxPerSecond * dtSeconds;
  const projectedLeft = proposedX + extents.minLocalX - extents.halfEnemyWidth;
  const projectedRight = proposedX + extents.maxLocalX + extents.halfEnemyWidth;
  const leftContactX = minBoundX - extents.minLocalX + extents.halfEnemyWidth;
  const rightContactX = maxBoundX - extents.maxLocalX - extents.halfEnemyWidth;

  if (projectedRight > maxBoundX) {
    return {
      reversed: true,
      state: {
        originX: Math.max(leftContactX, rightContactX),
        originY: state.originY + descendStep,
        direction: -1,
      },
    };
  }

  if (projectedLeft < minBoundX) {
    return {
      reversed: true,
      state: {
        originX: Math.min(rightContactX, leftContactX),
        originY: state.originY + descendStep,
        direction: 1,
      },
    };
  }

  return {
    reversed: false,
    state: {
      originX: proposedX,
      originY: state.originY,
      direction: state.direction,
    },
  };
};
