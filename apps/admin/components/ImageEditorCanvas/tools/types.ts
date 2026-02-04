export type ToolId = 'pencil' | 'eraser' | 'fill' | 'picker';

export type ToolContext = {
  getPixel(x: number, y: number): [number, number, number, number];
  setPixel(x: number, y: number, rgba: [number, number, number, number]): void;
  width: number;
  height: number;
  color: [number, number, number, number];
  brushSize: number;
};

export type ToolHandlers = {
  onPointerDown(px: number, py: number, ctx: ToolContext): void;
  onPointerMove(px: number, py: number, ctx: ToolContext): void;
  onPointerUp(px: number, py: number, ctx: ToolContext): void;
};
