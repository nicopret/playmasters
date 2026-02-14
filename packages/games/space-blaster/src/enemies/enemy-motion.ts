export type Point = { x: number; y: number };
export type DivePattern = 'straight' | 'sine' | 'track';

export const computeDiveStep = (params: {
  position: Point;
  speedPxPerSecond: number;
  dtMs: number;
}): Point => ({
  x: params.position.x,
  y: params.position.y + (params.speedPxPerSecond * params.dtMs) / 1000,
});

export const computeSineDiveStep = (params: {
  baseX: number;
  position: Point;
  speedPxPerSecond: number;
  dtMs: number;
  elapsedMs: number;
  amplitudePx: number;
  frequencyHz: number;
}): Point => {
  const nextElapsedMs = params.elapsedMs + params.dtMs;
  const tSeconds = nextElapsedMs / 1000;
  const oscillation =
    params.amplitudePx * Math.sin(Math.PI * 2 * params.frequencyHz * tSeconds);
  return {
    x: params.baseX + oscillation,
    y: params.position.y + (params.speedPxPerSecond * params.dtMs) / 1000,
  };
};

export const rotateTowardAngle = (params: {
  currentAngleRad: number;
  targetAngleRad: number;
  maxDeltaRad: number;
}): { nextAngleRad: number; appliedDeltaRad: number } => {
  const delta = normalizeAngleRad(
    params.targetAngleRad - params.currentAngleRad,
  );
  const clampedDelta = Math.max(
    -params.maxDeltaRad,
    Math.min(params.maxDeltaRad, delta),
  );
  return {
    nextAngleRad: params.currentAngleRad + clampedDelta,
    appliedDeltaRad: clampedDelta,
  };
};

export const computeTrackedDiveStep = (params: {
  position: Point;
  speedPxPerSecond: number;
  dtMs: number;
  currentAngleRad: number;
  target: Point;
  turnRateDegPerSecond: number;
}): { position: Point; angleRad: number; appliedDeltaRad: number } => {
  const dtSeconds = params.dtMs / 1000;
  const desiredAngle = Math.atan2(
    params.target.y - params.position.y,
    params.target.x - params.position.x,
  );
  const maxDeltaRad =
    (Math.max(0, params.turnRateDegPerSecond) * Math.PI * dtSeconds) / 180;
  const rotated = rotateTowardAngle({
    currentAngleRad: params.currentAngleRad,
    targetAngleRad: desiredAngle,
    maxDeltaRad,
  });
  const distance = params.speedPxPerSecond * dtSeconds;
  const nextX = params.position.x + Math.cos(rotated.nextAngleRad) * distance;
  const nextY = params.position.y + Math.sin(rotated.nextAngleRad) * distance;
  return {
    position: { x: nextX, y: nextY },
    angleRad: rotated.nextAngleRad,
    appliedDeltaRad: rotated.appliedDeltaRad,
  };
};

export const computeReturnStep = (params: {
  position: Point;
  target: Point;
  speedPxPerSecond: number;
  dtMs: number;
  arrivalThresholdPx: number;
}): { position: Point; arrived: boolean } => {
  const dx = params.target.x - params.position.x;
  const dy = params.target.y - params.position.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= params.arrivalThresholdPx) {
    return { position: params.target, arrived: true };
  }

  const maxStep = (params.speedPxPerSecond * params.dtMs) / 1000;
  if (maxStep >= distance) {
    return { position: params.target, arrived: true };
  }

  const nx = dx / distance;
  const ny = dy / distance;
  return {
    arrived: false,
    position: {
      x: params.position.x + nx * maxStep,
      y: params.position.y + ny * maxStep,
    },
  };
};

const normalizeAngleRad = (angleRad: number): number => {
  let normalized = angleRad;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
};
