import { useCallback, useEffect, useRef, useState } from 'react';
import { Pencil, Eraser, Palette, Square, Trash2 } from 'lucide-react';

/**
 * Freehand drawing over a note.
 *
 * The canvas lives inside the note (absolutely positioned in the editor, which
 * sits in the note's scroll area), so drawings scroll with the text and you can
 * scroll the page with the mouse wheel / trackpad while drawing. The canvas
 * covers the whole note and grows downwards when you draw near its bottom
 * edge, so there's always more room. It is drawn at the screen's pixel density
 * so strokes stay sharp on Retina displays.
 *
 * Saved as `flowdraw2|<pixel ratio>|<PNG data URL>` in note.drawing_data.
 * Older drawings (a PNG of the window, from before this) are converted on load.
 */

interface PersistentDrawingLayerProps {
  isDrawingMode: boolean;
  onExitDrawingMode: () => void;
  drawingData?: string;
  onDrawingChange?: (data: string) => void;
}

type Tool = 'pen' | 'eraser' | 'select';
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FORMAT = 'flowdraw2';
/** Draw within this many px of the bottom and the canvas grows by GROW_STEP. */
const GROW_MARGIN = 220;
const GROW_STEP = 700;
const SAVE_DELAY_MS = 400;

const COLORS = ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#ffffff'];

function parseDrawing(data: string): { src: string; ratio: number; legacy: boolean } | null {
  if (!data) return null;
  if (data.startsWith(`${FORMAT}|`)) {
    const [, ratio, ...rest] = data.split('|');
    return { src: rest.join('|'), ratio: Number(ratio) || 1, legacy: false };
  }
  if (data.startsWith('data:image')) return { src: data, ratio: 1, legacy: true };
  return null;
}

export const PersistentDrawingLayer = ({
  isDrawingMode,
  onExitDrawingMode,
  drawingData,
  onDrawingChange,
}: PersistentDrawingLayerProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 0, h: 0, ratio: 1 });
  const strokeRef = useRef<{ active: boolean; x: number; y: number; moved: boolean }>({ active: false, x: 0, y: 0, moved: false });
  const hasInkRef = useRef(false);
  const lastEmittedRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(3);
  const [selection, setSelection] = useState<Rect | null>(null);
  const [selectionDone, setSelectionDone] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const host = () => wrapperRef.current?.parentElement ?? null;

  /**
   * How far down the note's text goes (CSS px from the top of the note). Measured
   * from the last paragraph, not the editor's own height: the editor stretches to
   * fill the note, so its height would follow the canvas and grow forever.
   */
  const textBottom = () => {
    const parent = host();
    const last = parent?.querySelector('.ProseMirror')?.lastElementChild;
    if (!parent || !last) return 0;
    return last.getBoundingClientRect().bottom - parent.getBoundingClientRect().top + 80;
  };
  const scroller = () => wrapperRef.current?.closest<HTMLElement>('.overflow-y-auto') ?? null;

  /** Grow the canvas (never shrink), keeping what's drawn. Sizes are CSS px. */
  const ensureSize = useCallback((minW: number, minH: number) => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const ratio = window.devicePixelRatio || 1;
    const cur = sizeRef.current;
    const w = Math.ceil(Math.max(cur.w, minW));
    const h = Math.ceil(Math.max(cur.h, minH));
    if (w === cur.w && h === cur.h && ratio === cur.ratio) return;

    let snapshot: HTMLCanvasElement | null = null;
    if (cur.w && cur.h && hasInkRef.current) {
      snapshot = document.createElement('canvas');
      snapshot.width = canvas.width;
      snapshot.height = canvas.height;
      snapshot.getContext('2d')?.drawImage(canvas, 0, 0);
    }
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (snapshot) ctx.drawImage(snapshot, 0, 0, cur.w, cur.h);
    }
    sizeRef.current = { w, h, ratio };
    wrapper.style.height = `${h}px`;
    // Make the note itself tall enough to scroll to the bottom of the drawing.
    const parent = host();
    if (parent) parent.style.minHeight = `${h}px`;
  }, []);

  const save = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas || !onDrawingChange) return;
      const data = hasInkRef.current ? `${FORMAT}|${sizeRef.current.ratio}|${canvas.toDataURL('image/png')}` : '';
      lastEmittedRef.current = data;
      onDrawingChange(data);
    }, SAVE_DELAY_MS);
  }, [onDrawingChange]);

  // Size the canvas to the note, and follow it as the note grows.
  useEffect(() => {
    const parent = host();
    if (!parent) return;
    const fit = () => ensureSize(parent.clientWidth, textBottom());
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(parent);
    const editor = parent.querySelector('.ProseMirror');
    // Text added or removed: follow the content (the canvas only ever grows).
    const mo = new MutationObserver(fit);
    if (editor) mo.observe(editor, { childList: true, subtree: true, characterData: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [ensureSize]);

  // Load the saved drawing (unless it's the one we just saved).
  useEffect(() => {
    const data = drawingData ?? '';
    if (data === lastEmittedRef.current) return;
    lastEmittedRef.current = data;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const parsed = parseDrawing(data);
    if (!parsed) {
      ctx.clearRect(0, 0, sizeRef.current.w, sizeRef.current.h);
      hasInkRef.current = false;
      return;
    }
    const img = new Image();
    img.onload = () => {
      let dx = 0;
      let dy = 0;
      const w = img.width / parsed.ratio;
      const h = img.height / parsed.ratio;
      if (parsed.legacy) {
        // Old drawings were a snapshot of the whole window: line them up with the note.
        const rect = host()?.getBoundingClientRect();
        if (rect) {
          dx = -rect.left;
          dy = -(rect.top + (scroller()?.scrollTop ?? 0));
        }
      }
      hasInkRef.current = true;
      ensureSize(w + dx, h + dy);
      ctx.clearRect(0, 0, sizeRef.current.w, sizeRef.current.h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(img, dx, dy, w, h);
    };
    img.src = parsed.src;
  }, [drawingData, ensureSize]);

  // Entering drawing mode: make sure there's room to draw below the text.
  useEffect(() => {
    if (!isDrawingMode) {
      setSelection(null);
      setSelectionDone(false);
      setCursor(null);
      return;
    }
    const parent = host();
    const view = scroller();
    if (parent) ensureSize(parent.clientWidth, textBottom() + (view ? view.clientHeight * 0.6 : 400));
  }, [isDrawingMode, ensureSize]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const point = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const setupStroke = (ctx: CanvasRenderingContext2D) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = brushSize * 4;
      ctx.strokeStyle = ctx.fillStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = brushSize;
      ctx.strokeStyle = ctx.fillStyle = color;
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e);
    if (tool === 'select') {
      setSelection({ x: p.x, y: p.y, w: 0, h: 0 });
      setSelectionDone(false);
      strokeRef.current = { active: true, x: p.x, y: p.y, moved: false };
      return;
    }
    strokeRef.current = { active: true, x: p.x, y: p.y, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = point(e);
    if (tool === 'eraser') setCursor(p);
    const s = strokeRef.current;
    if (!s.active) return;

    if (tool === 'select') {
      setSelection({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
      return;
    }

    // Near the bottom: give the page more room.
    if (p.y > sizeRef.current.h - GROW_MARGIN) ensureSize(sizeRef.current.w, sizeRef.current.h + GROW_STEP);

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    setupStroke(ctx);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    strokeRef.current = { active: true, x: p.x, y: p.y, moved: true };
    if (tool === 'pen') hasInkRef.current = true;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = strokeRef.current;
    if (!s.active) return;
    strokeRef.current = { ...s, active: false };

    if (tool === 'select') {
      setSelectionDone(true);
      setSelection((sel) => (sel && sel.w > 5 && sel.h > 5 ? sel : null));
      return;
    }
    if (!s.moved) {
      // A click: draw (or erase) a dot.
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        const p = point(e);
        setupStroke(ctx);
        ctx.beginPath();
        ctx.arc(p.x, p.y, tool === 'eraser' ? brushSize * 2 : Math.max(1, brushSize / 2), 0, Math.PI * 2);
        ctx.fill();
        if (tool === 'pen') hasInkRef.current = true;
      }
    }
    save();
  };

  const deleteSelection = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !selection) return;
    ctx.clearRect(selection.x, selection.y, selection.w, selection.h);
    setSelection(null);
    setSelectionDone(false);
    save();
  }, [selection, save]);

  const clearAll = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, sizeRef.current.w, sizeRef.current.h);
    hasInkRef.current = false;
    save();
  };

  // Delete / Backspace removes the selected area.
  useEffect(() => {
    if (!isDrawingMode || !selection || !selectionDone) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelection();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDrawingMode, selection, selectionDone, deleteSelection]);

  return (
    <>
      <div
        ref={wrapperRef}
        className="absolute left-0 top-0 right-0 overflow-hidden"
        style={{ zIndex: isDrawingMode ? 50 : 30, pointerEvents: 'none' }}
      >
        <canvas
          ref={canvasRef}
          className="block"
          style={{
            pointerEvents: isDrawingMode ? 'auto' : 'none',
            cursor: tool === 'eraser' ? 'none' : 'crosshair',
            touchAction: isDrawingMode ? 'pan-y' : 'auto',
          }}
          onPointerDown={isDrawingMode ? onPointerDown : undefined}
          onPointerMove={isDrawingMode ? onPointerMove : undefined}
          onPointerUp={isDrawingMode ? onPointerUp : undefined}
          onPointerCancel={isDrawingMode ? onPointerUp : undefined}
          onPointerLeave={() => setCursor(null)}
        />

        {isDrawingMode && tool === 'eraser' && cursor && (
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              left: cursor.x,
              top: cursor.y,
              width: Math.max(10, brushSize * 4),
              height: Math.max(10, brushSize * 4),
              transform: 'translate(-50%, -50%)',
              border: '2px solid rgba(255,255,255,0.85)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
            }}
          />
        )}

        {isDrawingMode && selection && (
          <div
            className={`absolute border-2 border-dashed pointer-events-none ${
              selectionDone ? 'border-purple-500 bg-purple-500/20' : 'border-purple-400 bg-purple-400/10'
            }`}
            style={{ left: selection.x, top: selection.y, width: selection.w, height: selection.h }}
          >
            {selectionDone && (
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-auto">
                <button
                  onClick={deleteSelection}
                  className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded shadow-lg flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
                <button
                  onClick={() => {
                    setSelection(null);
                    setSelectionDone(false);
                  }}
                  className="px-3 py-1.5 text-sm bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded shadow-lg"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {isDrawingMode && (
        <>
          {/* Toolbar */}
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl p-3 flex items-center gap-3">
            <div className="flex items-center gap-2 pr-3 border-r border-[#2a2a2a]">
              {(
                [
                  ['pen', Pencil, 'Pen (Draw)'],
                  ['eraser', Eraser, 'Eraser'],
                  ['select', Square, 'Select & delete an area'],
                ] as const
              ).map(([t, Icon, title]) => (
                <button
                  key={t}
                  onClick={() => setTool(t)}
                  className={`p-2 rounded transition-colors ${tool === t ? 'bg-purple-600 text-white' : 'text-[#e5e5e5] hover:bg-[#252525]'}`}
                  title={title}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 pr-3 border-r border-[#2a2a2a]">
              <Palette className="w-4 h-4 text-[#888888] mr-1" />
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setColor(c);
                    if (tool !== 'pen') setTool('pen');
                  }}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>

            <div className="flex items-center gap-2 pr-3 border-r border-[#2a2a2a]">
              <input type="range" min="1" max="20" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-20" />
              <span className="text-xs text-[#888888] w-6">{brushSize}px</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={clearAll}
                className="px-3 py-1.5 text-sm text-red-400 hover:bg-red-600/20 rounded transition-colors flex items-center gap-1.5"
                title="Delete all drawings on this note"
              >
                <Trash2 className="w-4 h-4" /> Clear All
              </button>
              <button onClick={onExitDrawingMode} className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors">
                Done
              </button>
            </div>
          </div>

          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-[#1a1a1a]/90 border border-[#2a2a2a] rounded-lg px-4 py-2 pointer-events-none">
            <p className="text-sm text-[#888888]">
              {tool === 'select'
                ? selectionDone && selection
                  ? '🔲 Press Delete to remove the selected area'
                  : '🔲 Drag to select an area'
                : tool === 'eraser'
                  ? '🧹 Drag to erase'
                  : '✏️ Draw anywhere · scroll for more room'}{' '}
              · Auto-saves · <kbd className="px-1.5 py-0.5 bg-[#252525] rounded text-xs">Esc</kbd> to exit
            </p>
          </div>
        </>
      )}
    </>
  );
};
