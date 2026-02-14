export type Point = { x: number; y: number };

export const computeDiveStep = (params: {
  position: Point;
  speedPxPerSecond: number;
  dtMs: number;
}): Point => ({
  x: params.position.x,
  y: params.position.y + (params.speedPxPerSecond * params.dtMs) / 1000,
});

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
