'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './ImageEditorCanvas.module.css';
import {
  applyToolAtPoint,
  drawView,
  initEditor,
  loadImageDataFromUrl,
  setSource,
  type ViewState,
} from './engine';
import type { ToolId } from './tools';

type Props = {
  imageUrl?: string;
  initialImageData?: ImageData;
  tool: ToolId;
  color: string;
  zoom: number;
  showGrid?: boolean;
  onPickColor?: (hex: string) => void;
  onChange?: (data: ImageData) => void;
};

export function ImageEditorCanvas({
  imageUrl,
  initialImageData,
  tool,
  color,
  zoom,
  showGrid = true,
  onPickColor,
  onChange,
}: Props) {
  const viewRef = useRef<HTMLCanvasElement>(null);
  const [viewState, setViewState] = useState<ViewState>({
    zoom,
    pan: { x: 0, y: 0 },
    showGrid,
  });
  const editor = useMemo(() => (viewRef.current ? initEditor(viewRef.current) : null), [viewRef.current]);

  // keep zoom/grid in state
  useEffect(() => {
    setViewState((s) => ({ ...s, zoom, showGrid }));
  }, [zoom, showGrid]);

  // Load source image
  useEffect(() => {
    if (!editor) return;
    const load = async () => {
      if (initialImageData) {
        setSource(editor, initialImageData);
        drawView(editor, { ...viewState, zoom, showGrid });
        return;
      }
      if (imageUrl) {
        const data = await loadImageDataFromUrl(imageUrl);
        setSource(editor, data);
        drawView(editor, { ...viewState, zoom, showGrid });
      }
    };
    load();
  }, [editor, imageUrl, initialImageData, viewState, zoom, showGrid]);

  // Redraw on viewState change
  useEffect(() => {
    if (!editor || !editor.source) return;
    drawView(editor, viewState);
  }, [editor, viewState]);

  const handlePointer = (ev: React.PointerEvent) => {
    if (!editor || !editor.source) return;
    const rect = viewRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.floor((ev.clientX - rect.left - viewState.pan.x) / viewState.zoom);
    const y = Math.floor((ev.clientY - rect.top - viewState.pan.y) / viewState.zoom);
    applyToolAtPoint(editor, tool, { x, y }, color, onPickColor);
    onChange?.(editor.source);
    drawView(editor, viewState);
  };

  return (
    <div className={styles.wrap}>
      <canvas ref={viewRef} className={styles.viewCanvas} onPointerDown={handlePointer} />
    </div>
  );
}

export default ImageEditorCanvas;
