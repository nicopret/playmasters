'use client';
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './page.module.css';

type Tool = 'pencil' | 'eraser' | 'fill' | 'picker' | 'select';
type ParamInput = { assetId: string } | Promise<{ assetId: string }>;
export type SelectionState = {
  active: boolean;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  normalized: { x: number; y: number; width: number; height: number } | null;
};

// Generate mask ImageData: white inside selection (or full image if none), transparent outside.
export function generateMaskImageData(
  width: number,
  height: number,
  selection: SelectionState
): ImageData {
  const data = new ImageData(width, height);
  const white = [255, 255, 255, 255];
  const transparent = [0, 0, 0, 0];
  let inside: (x: number, y: number) => boolean = () => true;
  if (selection.normalized) {
    const { x, y, width: w, height: h } = selection.normalized;
    inside = (px, py) => px >= x && px < x + w && py >= y && py < y + h;
  }
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const idx = (py * width + px) * 4;
      const src = inside(px, py) ? white : transparent;
      data.data[idx] = src[0];
      data.data[idx + 1] = src[1];
      data.data[idx + 2] = src[2];
      data.data[idx + 3] = src[3];
    }
  }
  return data;
}

export function exportMaskAsBlob(mask: ImageData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = mask.width;
  canvas.height = mask.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('no_canvas'));
  ctx.putImageData(mask, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('blob_failed'));
      else resolve(blob);
    }, 'image/png');
  });
}

export default function EditPage({ params }: { params: ParamInput }) {
  const [assetId, setAssetId] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#ff0090');
  const [brushSize, setBrushSize] = useState(1);
  const [palette, setPalette] = useState<string[]>(['#ff0090', '#00d1ff', '#ffffff', '#000000']);
  const [zoom, setZoom] = useState(8);
  const [showGrid, setShowGrid] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selection, setSelection] = useState<SelectionState>({
    active: false,
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    normalized: null,
  });
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiScope, setAiScope] = useState<'all' | 'selection'>('all');
  const [aiStyle, setAiStyle] = useState<'pixel' | 'minimal' | 'modern'>('pixel');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPreview, setAiPreview] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiCollapsed, setAiCollapsed] = useState(false);
  const scopeRequiresSelection = aiScope === 'selection' && !selection.normalized;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const undoStack = useRef<ImageData[]>([]);
  const redoStack = useRef<ImageData[]>([]);
  const isPointerDown = useRef(false);
  const isSelecting = useRef(false);
  const hasMutatedInDrag = useRef(false);

  // Resolve params (can be Promise in Next)
  useEffect(() => {
    let alive = true;
    Promise.resolve(params)
      .then((p) => alive && setAssetId(p.assetId))
      .catch((err) => console.error('assetId_param_error', err));
    return () => {
      alive = false;
    };
  }, [params]);

  // Load current draft image
  useEffect(() => {
    if (!assetId) return;
    undoStack.current = [];
    redoStack.current = [];
    setSelection({
      active: false,
      startX: 0,
      startY: 0,
      endX: 0,
      endY: 0,
      normalized: null,
    });
    const load = async () => {
      setMessage('Loading draft...');
      try {
        const res = await fetch(`/api/assets/${assetId}/draft-image`, { cache: 'no-store' });
        if (!res.ok) throw new Error('draft_not_found');
        const blob = await res.blob();
        const image = new Image();
        image.onload = () => setImg(image);
        image.src = URL.createObjectURL(blob);
      } catch (err) {
        setMessage(`Error loading image: ${(err as Error).message}`);
      }
    };
    load();
  }, [assetId]);

  // Draw image to canvas when ready
  useEffect(() => {
    if (!img || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    canvasRef.current.width = img.width;
    canvasRef.current.height = img.height;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, img.width, img.height);
    ctx.drawImage(img, 0, 0);
    setMessage(null);
  }, [img]);

  const applyZoomStyles = useMemo(
    () =>
      ({
        width: img ? img.width * zoom : undefined,
        height: img ? img.height * zoom : undefined,
        '--grid-size': `${zoom}px`,
      }) as React.CSSProperties,
    [img, zoom]
  );

  const pushUndo = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !canvasRef.current) return;
    undoStack.current.push(ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height));
    if (undoStack.current.length > 30) undoStack.current.shift();
  };

  const handlePointer = (ev: React.PointerEvent) => {
    if (!canvasRef.current || !img || !assetId) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((ev.clientX - rect.left) / zoom);
    const y = Math.floor((ev.clientY - rect.top) / zoom);

    if (tool === 'select') {
      if (ev.type === 'pointerdown') {
        isSelecting.current = true;
        setSelection({
          active: true,
          startX: clamp(x, img.width),
          startY: clamp(y, img.height),
          endX: clamp(x, img.width),
          endY: clamp(y, img.height),
          normalized: null,
        });
      } else if (ev.type === 'pointermove' && isSelecting.current) {
        setSelection((sel) => ({
          ...sel,
          endX: clamp(x, img.width),
          endY: clamp(y, img.height),
        }));
      }
      return;
    }

    if (ev.type === 'pointerdown') {
      isPointerDown.current = true;
      pushUndo();
    }
    if (!isPointerDown.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const drawPixel = (px: number, py: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(px, py, 1, 1);
    };

    const applyFill = (sx: number, sy: number) => {
      const w = canvasRef.current!.width;
      const h = canvasRef.current!.height;
      const data = ctx.getImageData(0, 0, w, h);
      const targetIdx = (sy * w + sx) * 4;
      const target = data.data.slice(targetIdx, targetIdx + 4).join(',');
      const newColor = hexToRgba(color);
      const match = (idx: number) => data.data.slice(idx, idx + 4).join(',') === target;
      if (target === newColor.join(',')) return;
      const stack = [[sx, sy]];
      while (stack.length) {
        const [cx, cy] = stack.pop() as [number, number];
        if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
        const idx = (cy * w + cx) * 4;
        if (!match(idx)) continue;
        data.data[idx] = newColor[0];
        data.data[idx + 1] = newColor[1];
        data.data[idx + 2] = newColor[2];
        data.data[idx + 3] = newColor[3];
        stack.push([cx + 1, cy]);
        stack.push([cx - 1, cy]);
        stack.push([cx, cy + 1]);
        stack.push([cx, cy - 1]);
      }
      ctx.putImageData(data, 0, 0);
    };

    if (ev.type === 'pointerdown') {
      hasMutatedInDrag.current = false;
    }

    const mutateAtPoint = () => {
      for (let dy = 0; dy < brushSize; dy++) {
        for (let dx = 0; dx < brushSize; dx++) {
          const px = x + dx;
          const py = y + dy;
          if (px < 0 || py < 0 || px >= img.width || py >= img.height) continue;
          if (!isWithinSelection(px, py)) continue;
          if (tool === 'pencil') drawPixel(px, py, color);
          if (tool === 'eraser') drawPixel(px, py, 'rgba(0,0,0,0)');
          hasMutatedInDrag.current = true;
        }
      }
    };

    if (ev.type === 'pointerdown' && (tool === 'pencil' || tool === 'eraser' || tool === 'fill')) {
      mutateAtPoint();
      if (tool === 'fill') applyFill(x, y);
    } else if (ev.type === 'pointermove' && isPointerDown.current && (tool === 'pencil' || tool === 'eraser')) {
      mutateAtPoint();
    }
    if (tool === 'picker' && ev.type === 'pointerdown') {
      const data = ctx.getImageData(x, y, 1, 1).data;
      setColor(
        `#${[data[0], data[1], data[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`
      );
    }
    // palette update only if we mutated
    if (hasMutatedInDrag.current) {
      setPalette((prev) => {
        const next = [color, ...prev.filter((c) => c !== color)];
        return next.slice(0, 12);
      });
      setDirty(true);
    }
  };

  const handlePointerUp = () => {
    if (isSelecting.current) {
      setSelection((sel) => normalizeSelection(sel, img?.width ?? 0, img?.height ?? 0));
      isSelecting.current = false;
      return;
    }
    isPointerDown.current = false;
    hasMutatedInDrag.current = false;
  };

  const handleSave = async () => {
    if (!canvasRef.current || !assetId) return;
    setBusy(true);
    setMessage('Saving draft...');
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];
      const res = await fetch(`/api/assets/${assetId}/save-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pngBase64: base64, changeNotes: 'Pixel edit' }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'save_failed');
      setMessage('Saved as new draft version. Redirecting…');
      setDirty(false);
      // Refresh asset detail to show new draft/version
      setTimeout(() => {
        window.location.href = `/editor/images/${assetId}`;
      }, 600);
    } catch (err) {
      setMessage(`Save failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
    new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('blob_failed'));
      }, 'image/png');
    });

  const handleGenerateAI = async () => {
    if (!canvasRef.current || !assetId) return;
    if (scopeRequiresSelection) {
      setAiError('Selection scope requires an active selection.');
      return;
    }
    setAiError(null);
    setAiLoading(true);
    setMessage('Generating preview...');
    try {
      const baseImageBlob = await canvasToBlob(canvasRef.current);
      let maskBlob: Blob | undefined;
      if (aiScope === 'selection' && selection.normalized) {
        const mask = generateMaskImageData(img?.width ?? 0, img?.height ?? 0, selection);
        maskBlob = await exportMaskAsBlob(mask);
      }
      const form = new FormData();
      form.append('image', baseImageBlob, 'image.png');
      if (maskBlob) form.append('mask', maskBlob, 'mask.png');
      form.append('prompt', aiPrompt);
      form.append('style', aiStyle);
      form.append('assetId', assetId);
      form.append('derivedFromVersionId', '');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch('/api/image-edit', { method: 'POST', body: form, signal: controller.signal });
      clearTimeout(timeout);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.previewImageBase64) {
        const errMsg =
          res.status === 429
            ? 'Rate limit exceeded (max 10 per hour).'
            : json?.error || 'AI generate failed';
        throw new Error(errMsg);
      }
      setAiPreview(json.previewImageBase64);
    } catch (err) {
      const msg = (err as Error).message;
      setAiError(msg);
      setMessage(`AI error: ${msg}`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAcceptAI = async () => {
    if (!aiPreview || !assetId) return;
    setAiLoading(true);
    try {
      const blob = await (await fetch(`data:image/png;base64,${aiPreview}`)).blob();
      const form = new FormData();
      form.append('file', blob, 'ai.png');
      form.append('changeNotes', `AI edit: ${aiPrompt.slice(0, 100)}`);
      form.append('derivedFromVersionId', '');

      const res = await fetch(`/api/assets/${assetId}/versions`, { method: 'POST', body: form });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'version_create_failed');
      // clear local state and redirect
      undoStack.current = [];
      redoStack.current = [];
      setSelection({
        active: false,
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0,
        normalized: null,
      });
      window.location.href = `/editor/images/${assetId}`;
    } catch (err) {
      setMessage(`Accept failed: ${(err as Error).message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleDiscardAI = () => {
    setAiPreview(null);
    setMessage('Preview discarded.');
  };

  const undo = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height));
    ctx.putImageData(prev, 0, 0);
  };

  const redo = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height));
    ctx.putImageData(next, 0, 0);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const shift = e.shiftKey;
      if (e.key.toLowerCase() === 'z' && !shift) {
        e.preventDefault();
        undo();
      } else if ((e.key.toLowerCase() === 'z' && shift) || e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelection({
          active: false,
          startX: 0,
          startY: 0,
          endX: 0,
          endY: 0,
          normalized: null,
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const hexToRgba = (hex: string) => {
    const h = hex.replace('#', '');
    const int = parseInt(h, 16);
    return [(int >> 16) & 255, (int >> 8) & 255, int & 255, 255];
  };

  const normalizeSelection = (
    sel: typeof selection,
    w: number,
    h: number
  ): typeof selection => {
    const startX = clamp(Math.min(sel.startX, sel.endX), w);
    const endX = clamp(Math.max(sel.startX, sel.endX), w);
    const startY = clamp(Math.min(sel.startY, sel.endY), h);
    const endY = clamp(Math.max(sel.startY, sel.endY), h);
    const norm =
      endX > startX && endY > startY
        ? { x: startX, y: startY, width: endX - startX, height: endY - startY }
        : null;
    return { ...sel, normalized: norm };
  };

  const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max - 1));

  const isWithinSelection = (px: number, py: number) => {
    if (!selection.normalized) return true;
    const { x, y, width, height } = selection.normalized;
    return px >= x && px < x + width && py >= y && py < y + height;
  };


  const handleColorChange = (value: string) => {
    const normalized = value.startsWith('#') ? value : `#${value}`;
    if (/^#([0-9a-fA-F]{6})$/.test(normalized)) {
      setColor(normalized);
      setPalette((prev) => {
        const next = [normalized, ...prev.filter((c) => c !== normalized)];
        return next.slice(0, 12);
      });
    }
  };

  useEffect(() => {
    // if selection cleared while scope was selection, reset to whole image
    if (!selection.normalized && aiScope === 'selection') {
      setAiScope('all');
    }
  }, [selection.normalized, aiScope]);

  return (
    <div className={styles.page}>
      {!assetId ? (
        <div>Loading editor…</div>
      ) : (
        <div className={aiCollapsed ? styles.layoutCollapsed : styles.layout}>
          <div>
            <div className={styles.toolbar}>
              <button
                className={`${styles.button} ${tool === 'pencil' ? styles.active : ''}`}
                onClick={() => setTool('pencil')}
              >
                Pencil
            </button>
            <button
              className={`${styles.button} ${tool === 'eraser' ? styles.active : ''}`}
              onClick={() => setTool('eraser')}
            >
              Eraser
            </button>
            <button
              className={`${styles.button} ${tool === 'fill' ? styles.active : ''}`}
              onClick={() => setTool('fill')}
            >
              Fill
            </button>
            <button
          className={`${styles.button} ${tool === 'picker' ? styles.active : ''}`}
          onClick={() => setTool('picker')}
            >
              Picker
            </button>
            <button
              className={`${styles.button} ${tool === 'select' ? styles.active : ''}`}
              onClick={() => setTool('select')}
            >
              Select
            </button>
        <div className={styles.colorPanel}>
          <input
            type="color"
            value={color}
            onChange={(e) => handleColorChange(e.target.value)}
            className={styles.colorSwatch}
            aria-label="Color picker"
          />
          <input
            type="text"
            value={color}
            onChange={(e) => handleColorChange(e.target.value)}
            size={8}
            aria-label="Hex color"
          />
          <select
            className={styles.brushSelect}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 6, 8].map((b) => (
              <option key={b} value={b}>
                {b}px
              </option>
            ))}
          </select>
        </div>
        <div className={styles.palette}>
          {palette.map((p) => (
            <button
              key={p}
              className={styles.swatch}
              style={{ background: p }}
              onClick={() => setColor(p)}
              aria-label={`Use color ${p}`}
            />
          ))}
        </div>
            <label>
              Zoom
              <input
                type="range"
                min={2}
                max={24}
                step={1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
              {zoom}x
            </label>
            <label>
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
              />
              Grid
            </label>
            <span className={styles.chip}>Zoom: {zoom}x</span>
            {selection.normalized ? <span className={styles.chip}>Selection Active</span> : null}
            <label>
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
              />
              Grid
            </label>
            <button className={styles.button} onClick={undo} disabled={undoStack.current.length === 0}>
              Undo
            </button>
            <button className={styles.button} onClick={redo} disabled={redoStack.current.length === 0}>
              Redo
            </button>
            <button className={styles.button} onClick={handleSave} disabled={busy}>
              {busy ? 'Saving…' : 'Save as new draft'}
            </button>
            {dirty && <span className={styles.chip}>● Unsaved</span>}
            <button
              className={styles.button}
              onClick={async () => {
                if (!img) return;
                const mask = generateMaskImageData(img.width, img.height, selection);
                const blob = await exportMaskAsBlob(mask);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'mask.png';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download Mask
            </button>
            </div>

            <div className={styles.canvasOuter}>
              <div className={styles.canvasWrap} style={applyZoomStyles}>
                {aiPreview ? (
                  <>
                    <div className={styles.previewBanner}>
                      <span>AI Preview — Accept or Discard</span>
                      <button className={styles.button} onClick={handleAcceptAI} disabled={aiLoading}>
                        Accept
                      </button>
                      <button className={styles.button} onClick={handleDiscardAI} disabled={aiLoading}>
                        Discard
                      </button>
                    </div>
                    <img
                      src={`data:image/png;base64,${aiPreview}`}
                      alt="AI preview"
                      className={styles.previewImage}
                    />
                  </>
                ) : null}
                {selection.normalized ? <div className={styles.selectionOverlay} /> : null}
                <canvas
                  ref={canvasRef}
                  className={styles.canvas}
                  style={{ width: applyZoomStyles.width, height: applyZoomStyles.height }}
                  onPointerDown={handlePointer}
                  onPointerMove={handlePointer}
                  onPointerUp={handlePointerUp}
                />
                {selection.normalized ? (
                  <div
                    className={styles.selection}
                    style={{
                      left: selection.normalized.x * zoom,
                      top: selection.normalized.y * zoom,
                      width: selection.normalized.width * zoom,
                      height: selection.normalized.height * zoom,
                      borderWidth: Math.max(1, Math.floor(zoom / 2)),
                    }}
                  />
                ) : null}
                {showGrid && <div ref={overlayRef} className={styles.gridOverlay} style={applyZoomStyles} />}
              </div>
            </div>

            <div className={styles.bottomBar}>
              <div className={styles.status}>{message ?? 'Ready'}</div>
            </div>
          </div>

          {!aiCollapsed && (
            <aside className={styles.aiPanel}>
              <h4>AI Edit</h4>
              <button className={styles.button} onClick={() => setAiCollapsed(true)}>
                Hide AI Panel
              </button>
            <textarea
              className={styles.textarea}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Describe the change…"
            />
            <label>
              Scope
              <select
                className={styles.select}
                value={aiScope}
                onChange={(e) => setAiScope(e.target.value as 'all' | 'selection')}
                disabled={!selection.normalized && aiScope === 'selection'}
              >
                <option value="all">Whole Image</option>
                <option value="selection">Selection Only</option>
              </select>
            </label>
            <label>
              Style
              <select
                className={styles.select}
                value={aiStyle}
                onChange={(e) => setAiStyle(e.target.value as 'pixel' | 'minimal' | 'modern')}
              >
                <option value="pixel">Pixel Art</option>
                <option value="minimal">Minimal</option>
                <option value="modern">Modern</option>
              </select>
            </label>
            {scopeRequiresSelection ? (
              <div className={styles.status}>Selection Only requires an active selection.</div>
            ) : null}
            <button
              className={styles.button}
              onClick={handleGenerateAI}
              disabled={aiLoading || !aiPrompt || scopeRequiresSelection}
            >
              {aiLoading ? 'Generating…' : 'Generate'}
            </button>
            {aiError ? <div className={styles.status}>Error: {aiError}</div> : null}
            <div className={styles.status}>
              AI edits always create a new Draft version. Original images are never overwritten.
            </div>
              {aiLoading ? <div className={styles.status}>Loading…</div> : null}
            </aside>
          )}
          {aiCollapsed && (
            <div>
              <button className={styles.button} onClick={() => setAiCollapsed(false)}>
                Show AI Panel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
