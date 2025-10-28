import { useEffect, useRef, useState } from 'react';
import { Pencil, Eraser, X, Palette, Undo, Redo } from 'lucide-react';

interface DrawingOverlayProps {
  isActive: boolean;
  onClose: () => void;
  onSave?: (imageData: string) => void;
}

export const DrawingOverlay = ({ isActive, onClose, onSave }: DrawingOverlayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#a855f7');
  const [brushSize, setBrushSize] = useState(3);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);

  const colors = [
    '#a855f7', // Purple
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#ffffff', // White
  ];

  useEffect(() => {
    if (!isActive || !canvasRef.current) return;

    const canvas = canvasRef.current;
    
    // Use full window dimensions for canvas
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Set up canvas context
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, [isActive]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = brushSize * 3;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    // Save to history
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(imageData);
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);
      }
    }
  };

  const undo = () => {
    if (historyStep > 0) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const prevStep = historyStep - 1;
          ctx.putImageData(history[prevStep], 0, 0);
          setHistoryStep(prevStep);
        }
      }
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const nextStep = historyStep + 1;
          ctx.putImageData(history[nextStep], 0, 0);
          setHistoryStep(nextStep);
        }
      }
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Drawing Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      />

      {/* Toolbar */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl p-3 flex items-center gap-3">
        {/* Tool Selection */}
        <div className="flex items-center gap-2 pr-3 border-r border-[#2a2a2a]">
          <button
            onClick={() => setTool('pen')}
            className={`p-2 rounded transition-colors ${
              tool === 'pen' ? 'bg-purple-600 text-white' : 'text-[#e5e5e5] hover:bg-[#252525]'
            }`}
            title="Pen"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={`p-2 rounded transition-colors ${
              tool === 'eraser' ? 'bg-purple-600 text-white' : 'text-[#e5e5e5] hover:bg-[#252525]'
            }`}
            title="Eraser"
          >
            <Eraser className="w-4 h-4" />
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

        {/* History */}
        <div className="flex items-center gap-2 pr-3 border-r border-[#2a2a2a]">
          <button
            onClick={undo}
            disabled={historyStep <= 0}
            className="p-2 rounded text-[#e5e5e5] hover:bg-[#252525] disabled:opacity-30 disabled:cursor-not-allowed"
            title="Undo"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={historyStep >= history.length - 1}
            className="p-2 rounded text-[#e5e5e5] hover:bg-[#252525] disabled:opacity-30 disabled:cursor-not-allowed"
            title="Redo"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={clearCanvas}
            className="px-3 py-1.5 text-sm text-[#e5e5e5] hover:bg-[#252525] rounded transition-colors"
          >
            Clear
          </button>
          <button
            onClick={() => {
              if (onSave && canvasRef.current) {
                const imageData = canvasRef.current.toDataURL();
                onSave(imageData);
              }
              onClose();
            }}
            className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
          >
            Apply Drawing
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-[#e5e5e5] hover:bg-[#252525] rounded transition-colors"
          >
            Revert
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-[#1a1a1a]/90 border border-[#2a2a2a] rounded-lg px-4 py-2">
        <p className="text-sm text-[#888888]">
          Draw anywhere on screen • <kbd className="px-1.5 py-0.5 bg-[#252525] rounded text-xs">Apply</kbd> to save • <kbd className="px-1.5 py-0.5 bg-[#252525] rounded text-xs">Revert</kbd> or <kbd className="px-1.5 py-0.5 bg-[#252525] rounded text-xs">Esc</kbd> to discard
        </p>
      </div>
    </div>
  );
};
