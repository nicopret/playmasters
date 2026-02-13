export type PlayerHorizontalMotionState = {
  x: number;
  velocityX: number;
};

export type PlayerHorizontalMotionParams = {
  minX: number;
  maxX: number;
  halfWidth: number;
  maxSpeedPxPerSec: number;
};

const clampAxis = (axis: number): -1 | 0 | 1 => {
  if (axis < 0) return -1;
  if (axis > 0) return 1;
  return 0;
};

export const integrateHorizontalMotion = (
  state: PlayerHorizontalMotionState,
  inputAxis: number,
  dtMs: number,
  params: PlayerHorizontalMotionParams,
): PlayerHorizontalMotionState => {
  const dtSeconds = Math.max(0, dtMs) / 1000;
  const axis = clampAxis(inputAxis);
  const rawVelocityX = axis * params.maxSpeedPxPerSec;
  const minBound = params.minX + params.halfWidth;
  const maxBound = params.maxX - params.halfWidth;

  let x = state.x + rawVelocityX * dtSeconds;
  let velocityX = rawVelocityX;

  if (x <= minBound) {
    x = minBound;
    if (axis < 0) velocityX = 0;
  } else if (x >= maxBound) {
    x = maxBound;
    if (axis > 0) velocityX = 0;
  }

  return { x, velocityX };
};
