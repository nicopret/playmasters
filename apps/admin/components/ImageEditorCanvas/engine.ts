import type { ToolId } from './tools';
import { toolFor } from './tools';

export type Point = { x: number; y: number };

export type ViewState = {
  zoom: number;
  pan: Point;
  showGrid: boolean;
};

export type ImageEditorState = {
  source: ImageData | null;
  view: HTMLCanvasElement;
  sourceCanvas: HTMLCanvasElement;
};

export async function loadImageDataFromUrl(url: string): Promise<ImageData> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no_canvas_context');
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height);
}

export function initEditor(
  viewCanvas: HTMLCanvasElement
): ImageEditorState {
  const sourceCanvas = document.createElement('canvas');
  const state: ImageEditorState = {
    source: null,
    view: viewCanvas,
    sourceCanvas,
  };
  return state;
}

export function setSource(
  state: ImageEditorState,
  data: ImageData
) {
  state.source = data;
  state.sourceCanvas.width = data.width;
  state.sourceCanvas.height = data.height;
  const sctx = state.sourceCanvas.getContext('2d');
  if (!sctx) throw new Error('no_source_ctx');
  sctx.putImageData(data, 0, 0);
}

export function drawView(
  state: ImageEditorState,
  viewState: ViewState
) {
  if (!state.source) return;
  const vctx = state.view.getContext('2d');
  if (!vctx) return;

  const { zoom, pan } = viewState;
  const targetW = Math.max(1, Math.floor(state.source.width * zoom));
  const targetH = Math.max(1, Math.floor(state.source.height * zoom));
  state.view.width = targetW;
  state.view.height = targetH;

  vctx.imageSmoothingEnabled = false;
  vctx.clearRect(0, 0, targetW, targetH);
  vctx.save();
  vctx.translate(pan.x, pan.y);
  vctx.scale(zoom, zoom);
  vctx.drawImage(state.sourceCanvas, 0, 0);
  vctx.restore();

  if (viewState.showGrid && zoom >= 2) {
    drawGrid(vctx, state.source.width, state.source.height, zoom, pan);
  }
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  zoom: number,
  pan: Point
) {
  ctx.save();
  ctx.translate(pan.x, pan.y);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= w; x++) {
    const px = x * zoom + 0.5;
    ctx.moveTo(px, 0);
    ctx.lineTo(px, h * zoom);
  }
  for (let y = 0; y <= h; y++) {
    const py = y * zoom + 0.5;
    ctx.moveTo(0, py);
    ctx.lineTo(w * zoom, py);
  }
  ctx.stroke();
  ctx.restore();
}

export function applyToolAtPoint(
  state: ImageEditorState,
  tool: ToolId,
  point: Point,
  color: string,
  onPick?: (hex: string) => void
) {
  if (!state.source) return;
  const handler = toolFor(tool);
  if (!handler) return;

  const ctx: import('./tools').ToolContext = {
    width: state.source.width,
    height: state.source.height,
    brushSize: 1,
    color: hexToRgba(color),
    getPixel: (x, y) => {
      const idx = (y * state.source!.width + x) * 4;
      const d = state.source!.data;
      return [d[idx], d[idx + 1], d[idx + 2], d[idx + 3]];
    },
    setPixel: (x, y, rgba) => {
      const idx = (y * state.source!.width + x) * 4;
      const d = state.source!.data;
      d[idx] = rgba[0];
      d[idx + 1] = rgba[1];
      d[idx + 2] = rgba[2];
      d[idx + 3] = rgba[3];
    },
  };

  handler.onPointerDown(point.x, point.y, ctx);
  const sctx = state.sourceCanvas.getContext('2d');
  if (!sctx) return;
  sctx.putImageData(state.source, 0, 0);
}

function hexToRgba(hex: string): [number, number, number, number] {
  const h = hex.replace('#', '');
  const int = parseInt(h, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255, 255];
}
