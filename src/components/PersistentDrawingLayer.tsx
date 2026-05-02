import { useEffect, useRef, useState } from 'react';
import { Pencil, Eraser, Palette, Square, Trash2 } from 'lucide-react';

interface PersistentDrawingLayerProps {
  isDrawingMode: boolean;
  onExitDrawingMode: () => void;
  drawingData?: string; // Base64 image data
  onDrawingChange?: (data: string) => void;
}

export const PersistentDrawingLayer = ({ 
  isDrawingMode, 
  onExitDrawingMode,
  drawingData,
  onDrawingChange 
}: PersistentDrawingLayerProps) => {
  // Reduced logging - only log when drawing mode changes
  useEffect(() => {
    if (isDrawingMode) {
      console.log('🎨 DRAWING MODE ACTIVATED');
    }
  }, [isDrawingMode]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#a855f7');
  const [brushSize, setBrushSize] = useState(3);
  const [tool, setTool] = useState<'pen' | 'eraser' | 'select'>('pen');
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
  const [hasActiveSelection, setHasActiveSelection] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const lastDebugLogAtRef = useRef(0);

  const debugEnabled = (() => {
    try {
      return localStorage.getItem('drawingDebug') === 'true';
    } catch {
      return false;
    }
  })();

  const debugLog = (...args: any[]) => {
    if (!debugEnabled) return;
    console.log(...args);
  };

  const sampleAlpha = (
    ctx: CanvasRenderingContext2D | null,
    x: number,
    y: number
  ) => {
    if (!ctx) return null;
    const canvas = ctx.canvas;
    const px = Math.max(0, Math.min(canvas.width - 1, Math.floor(x)));
    const py = Math.max(0, Math.min(canvas.height - 1, Math.floor(y)));
    try {
      const a = ctx.getImageData(px, py, 1, 1).data[3];
      return { a, px, py };
    } catch {
      return null;
    }
  };

  const colors = [
    '#a855f7', '#3b82f6', '#10b981', '#f59e0b',
    '#ef4444', '#ec4899', '#06b6d4', '#ffffff',
  ];

  useEffect(() => {
    debugLog('🧩 [drawingDebug] tool changed', { tool });
  }, [tool]);

  useEffect(() => {
    debugLog('🧩 [drawingDebug] brush size changed', { brushSize, effectiveEraser: brushSize * 4 });
  }, [brushSize]);

  // Handle Delete key for selection
  useEffect(() => {
    if (!isDrawingMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && hasActiveSelection) {
        e.preventDefault();
        deleteSelectedArea();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawingMode, hasActiveSelection, selectionStart, selectionEnd]);

  // Initialize display canvas on mount (always visible)
  useEffect(() => {
    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas) return;

    displayCanvas.width = window.innerWidth;
    displayCanvas.height = window.innerHeight;

    const displayCtx = displayCanvas.getContext('2d');
    if (displayCtx) {
      displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
    }

    // Load existing drawing data to display canvas
    if (drawingData && drawingData.length > 0) {
      console.log('📥 LOADING DRAWING DATA - Length:', drawingData.length);
      debugLog('🧩 [drawingDebug] displayCanvas size', {
        w: displayCanvas.width,
        h: displayCanvas.height,
        devicePixelRatio: window.devicePixelRatio,
      });
      const img = new Image();
      img.onload = () => {
        const ctx = displayCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
          ctx.drawImage(img, 0, 0);
          console.log('✅ DRAWING LOADED TO DISPLAY');
          debugLog('🧩 [drawingDebug] display image loaded', {
            imgW: img.width,
            imgH: img.height,
          });
        }
      };
      img.onerror = () => {
        console.error('❌ FAILED TO LOAD DRAWING');
        debugLog('🧩 [drawingDebug] display image failed to load');
      };
      img.src = drawingData;
    } else {
      console.log('ℹ️ No drawing data for this note');
      debugLog('🧩 [drawingDebug] display cleared due to empty drawingData');
    }
  }, [drawingData]);

  // Initialize drawing canvas when drawing mode is activated
  useEffect(() => {
    if (!isDrawingMode) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    // Clear first, then copy saved drawing into drawing canvas when entering drawing mode
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    debugLog('🧩 [drawingDebug] enter drawing mode', {
      canvasW: canvas.width,
      canvasH: canvas.height,
      drawingDataLength: drawingData ? drawingData.length : 0,
      devicePixelRatio: window.devicePixelRatio,
    });
    if (drawingData && drawingData.length > 0) {
      const img = new Image();
      img.onload = () => {
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          console.log('✅ DRAWING LOADED TO DRAWING CANVAS');
          debugLog('🧩 [drawingDebug] drawing image loaded', {
            imgW: img.width,
            imgH: img.height,
          });
        }
      };
      img.onerror = () => {
        debugLog('🧩 [drawingDebug] drawing image failed to load');
      };
      img.src = drawingData;
    }
  }, [isDrawingMode, drawingData]);

  // Auto-save on any change
  const saveDrawing = () => {
    if (canvasRef.current && onDrawingChange) {
      const imageData = canvasRef.current.toDataURL();
      console.log('💾 SAVING DRAWING - Length:', imageData.length);
      onDrawingChange(imageData);
      
      // Also update display canvas
      if (displayCanvasRef.current) {
        const ctx = displayCanvasRef.current.getContext('2d');
        const img = new Image();
        img.onload = () => {
          if (ctx) {
            ctx.clearRect(0, 0, displayCanvasRef.current!.width, displayCanvasRef.current!.height);
            ctx.drawImage(img, 0, 0);
          }
        };
        img.src = imageData;
      }
    } else {
      console.warn('⚠️ Cannot save drawing: canvas or onDrawingChange missing');
    }
  };

  const getDisplayCtx = () => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  };

  const configureCtxForTool = (ctx: CanvasRenderingContext2D, activeTool: 'pen' | 'eraser', x: number, y: number) => {
    if (activeTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = brushSize * 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      return;
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setCursorPos({ x: e.clientX, y: e.clientY });

    setIsDrawing(true);
    const x = e.clientX;
    const y = e.clientY;

    if (tool === 'select') {
      // Start selection rectangle
      setSelectionStart({ x, y });
      setSelectionEnd({ x, y });
    } else {
      const displayCtx = getDisplayCtx();
      configureCtxForTool(ctx, tool, x, y);
      if (displayCtx) configureCtxForTool(displayCtx, tool, x, y);

      if (tool === 'eraser') {
        const now = Date.now();
        if (debugEnabled && now - lastDebugLogAtRef.current > 250) {
          lastDebugLogAtRef.current = now;
          debugLog('🧽 [drawingDebug] eraser down', {
            x,
            y,
            brushSize,
            effective: brushSize * 4,
            drawingAlpha: sampleAlpha(ctx, x, y),
            displayAlpha: sampleAlpha(displayCtx, x, y),
          });
        }
      }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const x = e.clientX;
    const y = e.clientY;

    setCursorPos({ x, y });

    if (tool === 'select' && selectionStart && isDrawing) {
      setSelectionEnd({ x, y });
      return;
    }

    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const displayCtx = getDisplayCtx();

    if (tool === 'eraser') {
      const now = Date.now();
      if (debugEnabled && now - lastDebugLogAtRef.current > 350) {
        lastDebugLogAtRef.current = now;
        debugLog('🧽 [drawingDebug] eraser move', {
          x,
          y,
          brushSize,
          effective: brushSize * 4,
          drawingAlpha: sampleAlpha(ctx, x, y),
          displayAlpha: sampleAlpha(displayCtx, x, y),
        });
      }
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);

    if (displayCtx) {
      displayCtx.lineTo(x, y);
      displayCtx.stroke();
      displayCtx.beginPath();
      displayCtx.moveTo(x, y);
    }
  };

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing && tool !== 'select') return;
    
    if (tool === 'select' && selectionStart && selectionEnd) {
      // Finalize selection (don't delete yet)
      const width = Math.abs(selectionEnd.x - selectionStart.x);
      const height = Math.abs(selectionEnd.y - selectionStart.y);
      
      // Only create selection if it's big enough (not just a click)
      if (width > 5 && height > 5) {
        setHasActiveSelection(true);
      } else {
        // Clear selection if too small
        setSelectionStart(null);
        setSelectionEnd(null);
        setHasActiveSelection(false);
      }
    } else if (tool === 'pen' || tool === 'eraser') {
      // Check if this was a single click (no drag) - draw a dot
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const x = e.clientX;
          const y = e.clientY;
          const displayCtx = getDisplayCtx();
          
          // Set fill style for dot
          if (tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(0,0,0,1)';
            if (displayCtx) {
              displayCtx.globalCompositeOperation = 'destination-out';
              displayCtx.fillStyle = 'rgba(0,0,0,1)';
            }
          } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = color;
            if (displayCtx) {
              displayCtx.globalCompositeOperation = 'source-over';
              displayCtx.fillStyle = color;
            }
          }
          
          // Draw a dot (small circle) for single clicks
          ctx.beginPath();
          ctx.arc(x, y, brushSize, 0, Math.PI * 2);
          ctx.fill();

          if (displayCtx) {
            displayCtx.beginPath();
            displayCtx.arc(x, y, tool === 'eraser' ? brushSize * 2 : brushSize, 0, Math.PI * 2);
            displayCtx.fill();
          }
        }
      }
    }
    
    setIsDrawing(false);
    if (tool !== 'select') {
      saveDrawing(); // Auto-save after each stroke
    }

    if (tool === 'eraser') {
      const canvas = canvasRef.current;
      const ctx = canvas ? canvas.getContext('2d') : null;
      const displayCtx = getDisplayCtx();
      const x = e.clientX;
      const y = e.clientY;
      debugLog('🧽 [drawingDebug] eraser up', {
        x,
        y,
        brushSize,
        effective: brushSize * 4,
        drawingAlpha: sampleAlpha(ctx, x, y),
        displayAlpha: sampleAlpha(displayCtx, x, y),
      });
    }
  };

  const deleteSelectedArea = () => {
    if (!selectionStart || !selectionEnd) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate selection rectangle
    const x = Math.min(selectionStart.x, selectionEnd.x);
    const y = Math.min(selectionStart.y, selectionEnd.y);
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);

    // Clear the selected area
    ctx.clearRect(x, y, width, height);
    
    // Clear selection
    setSelectionStart(null);
    setSelectionEnd(null);
    setHasActiveSelection(false);
    
    saveDrawing();
  };

  const clearSelection = () => {
    setSelectionStart(null);
    setSelectionEnd(null);
    setHasActiveSelection(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const displayCanvas = displayCanvasRef.current;
    if (canvas && displayCanvas) {
      const ctx = canvas.getContext('2d');
      const displayCtx = displayCanvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (displayCtx) displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
      saveDrawing();
    }
  };

  return (
    <>
      {/* Display Canvas - Always visible, shows saved drawings */}
      <canvas
        ref={displayCanvasRef}
        className="fixed inset-0 pointer-events-none z-30"
        style={{ mixBlendMode: 'normal' }}
      />

      {/* Drawing Mode Overlay */}
      {isDrawingMode && (
        <div className="fixed inset-0 z-50" style={{ pointerEvents: 'auto' }}>
          {/* Drawing Canvas - Only active in drawing mode */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0"
            style={{ 
              backgroundColor: 'transparent',
              cursor: tool === 'select' ? 'crosshair' : tool === 'eraser' ? 'none' : 'crosshair'
            }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={(e) => {
              if (isDrawing) stopDrawing(e);
            }}
          />

          {tool === 'eraser' && cursorPos && (
            <div
              className="fixed z-[60]"
              style={{
                left: cursorPos.x,
                top: cursorPos.y,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
              }}
            >
              <div
                className="rounded-full"
                style={{
                  width: Math.max(10, brushSize * 4),
                  height: Math.max(10, brushSize * 4),
                  border: '2px solid rgba(255,255,255,0.85)',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
                  background: 'transparent',
                }}
              />
            </div>
          )}

          {/* Selection Rectangle */}
          {tool === 'select' && selectionStart && selectionEnd && (
            <div
              className={`absolute border-2 border-dashed ${
                hasActiveSelection 
                  ? 'border-purple-500 bg-purple-500/20' 
                  : 'border-purple-400 bg-purple-400/10'
              } pointer-events-none`}
              style={{
                left: Math.min(selectionStart.x, selectionEnd.x),
                top: Math.min(selectionStart.y, selectionEnd.y),
                width: Math.abs(selectionEnd.x - selectionStart.x),
                height: Math.abs(selectionEnd.y - selectionStart.y),
              }}
            >
              {/* Selection Action Buttons */}
              {hasActiveSelection && (
                <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 flex gap-2 pointer-events-auto">
                  <button
                    onClick={deleteSelectedArea}
                    className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded shadow-lg transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                  <button
                    onClick={clearSelection}
                    className="px-3 py-1.5 text-sm bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded shadow-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Toolbar */}
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl p-3 flex items-center gap-3">
            {/* Tool Selection */}
            <div className="flex items-center gap-2 pr-3 border-r border-[#2a2a2a]">
              <button
                onClick={() => setTool('pen')}
                className={`p-2 rounded transition-colors ${
                  tool === 'pen' ? 'bg-purple-600 text-white' : 'text-[#e5e5e5] hover:bg-[#252525]'
                }`}
                title="Pen (Draw)"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTool('eraser')}
                className={`p-2 rounded transition-colors ${
                  tool === 'eraser' ? 'bg-purple-600 text-white' : 'text-[#e5e5e5] hover:bg-[#252525]'
                }`}
                title="Eraser (Smooth)"
              >
                <Eraser className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTool('select')}
                className={`p-2 rounded transition-colors ${
                  tool === 'select' ? 'bg-purple-600 text-white' : 'text-[#e5e5e5] hover:bg-[#252525]'
                }`}
                title="Select & Delete Area"
              >
                <Square className="w-4 h-4" />
              </button>
            </div>

            {/* Color Palette */}
            <div className="flex items-center gap-1 pr-3 border-r border-[#2a2a2a]">
              <Palette className="w-4 h-4 text-[#888888] mr-1" />
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    color === c ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>

            {/* Brush Size */}
            <div className="flex items-center gap-2 pr-3 border-r border-[#2a2a2a]">
              <input
                type="range"
                min="1"
                max="20"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-20"
              />
              <span className="text-xs text-[#888888] w-6">{brushSize}px</span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={clearCanvas}
                className="px-3 py-1.5 text-sm text-red-400 hover:bg-red-600/20 rounded transition-colors flex items-center gap-1.5"
                title="Delete all drawings"
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </button>
              <button
                onClick={onExitDrawingMode}
                className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
              >
                Done
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-[#1a1a1a]/90 border border-[#2a2a2a] rounded-lg px-4 py-2">
            <p className="text-sm text-[#888888]">
              {tool === 'select' 
                ? hasActiveSelection
                  ? '🔲 Press Delete or click Delete button to remove selection'
                  : '🔲 Drag to select area • Press Delete to remove'
                : tool === 'eraser'
                ? '🧹 Click and drag to erase • Auto-saves'
                : '✏️ Draw anywhere • Auto-saves'
              } • Press <kbd className="px-1.5 py-0.5 bg-[#252525] rounded text-xs">Esc</kbd> to exit
            </p>
          </div>
        </div>
      )}
    </>
  );
};
