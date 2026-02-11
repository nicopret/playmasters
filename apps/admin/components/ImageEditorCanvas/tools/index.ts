import type { ToolContext, ToolHandlers, ToolId } from './types';

const pencil: ToolHandlers = {
  onPointerDown: (x, y, ctx) => paintSquare(x, y, ctx, ctx.color),
  onPointerMove: (x, y, ctx) => paintSquare(x, y, ctx, ctx.color),
  onPointerUp: () => undefined,
};

const eraser: ToolHandlers = {
  onPointerDown: (x, y, ctx) => paintSquare(x, y, ctx, [0, 0, 0, 0]),
  onPointerMove: (x, y, ctx) => paintSquare(x, y, ctx, [0, 0, 0, 0]),
  onPointerUp: () => undefined,
};

const picker: ToolHandlers = {
  onPointerDown: (x, y, ctx) => {
    const [r, g, b, a] = ctx.getPixel(x, y);
    ctx.color = [r, g, b, a];
  },
  onPointerMove: () => undefined,
  onPointerUp: () => undefined,
};

const fill: ToolHandlers = {
  onPointerDown: (x, y, ctx) => floodFill(x, y, ctx, ctx.color),
  onPointerMove: () => undefined,
  onPointerUp: () => undefined,
};

const map: Record<ToolId, ToolHandlers> = {
  pencil,
  eraser,
  picker,
  fill,
};

export function toolFor(id: ToolId): ToolHandlers {
  return map[id];
}

function paintSquare(x: number, y: number, ctx: ToolContext, rgba: [number, number, number, number]) {
  const half = Math.floor(ctx.brushSize / 2);
  for (let dy = -half; dy < -half + ctx.brushSize; dy++) {
    for (let dx = -half; dx < -half + ctx.brushSize; dx++) {
      const px = x + dx;
      const py = y + dy;
      if (px < 0 || py < 0 || px >= ctx.width || py >= ctx.height) continue;
      ctx.setPixel(px, py, rgba);
    }
  }
}

function floodFill(sx: number, sy: number, ctx: ToolContext, targetColor: [number, number, number, number]) {
  const start = ctx.getPixel(sx, sy);
  if (equalsColor(start, targetColor)) return;
  const stack: Array<[number, number]> = [[sx, sy]];
  while (stack.length) {
    const [x, y] = stack.pop() as [number, number];
    if (x < 0 || y < 0 || x >= ctx.width || y >= ctx.height) continue;
    const current = ctx.getPixel(x, y);
    if (!equalsColor(current, start)) continue;
    ctx.setPixel(x, y, targetColor);
    stack.push([x + 1, y]);
    stack.push([x - 1, y]);
    stack.push([x, y + 1]);
    stack.push([x, y - 1]);
  }
}

function equalsColor(a: [number, number, number, number], b: [number, number, number, number]) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

export { hexToRgba, rgbaToHex } from './utils';
export type { ToolId, ToolContext, ToolHandlers } from './types';
