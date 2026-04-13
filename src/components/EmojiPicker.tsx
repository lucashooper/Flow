import { useRef, useEffect, useState, useCallback } from 'react';
import EmojiPickerReact, { Theme } from 'emoji-picker-react';
import { motion } from 'framer-motion';

interface EmojiPickerProps {
  position: { x: number; y: number };
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export const EmojiPicker = ({ position, onSelect, onClose }: EmojiPickerProps) => {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(() => {
    try {
      const saved = localStorage.getItem('emojiPickerSize');
      return saved ? JSON.parse(saved) : { width: 350, height: 400 };
    } catch {
      return { width: 350, height: 400 };
    }
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStart = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isResizing) return;
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, isResizing]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.width, h: size.height };

    const handleResizeMove = (ev: MouseEvent) => {
      if (!resizeStart.current) return;
      const dx = ev.clientX - resizeStart.current.x;
      const dy = ev.clientY - resizeStart.current.y;
      const newW = Math.max(280, Math.min(600, resizeStart.current.w + dx));
      const newH = Math.max(300, Math.min(600, resizeStart.current.h + dy));
      setSize({ width: newW, height: newH });
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
      resizeStart.current = null;
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      // Persist size
      setSize((s: { width: number; height: number }) => {
        localStorage.setItem('emojiPickerSize', JSON.stringify(s));
        return s;
      });
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }, [size]);

  return (
    <motion.div
      ref={pickerRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.12 }}
      className="fixed z-[200]"
      style={{ left: position.x, top: position.y }}
    >
      <div className="relative">
        <EmojiPickerReact
          onEmojiClick={(emojiData) => onSelect(emojiData.emoji)}
          theme={Theme.DARK}
          searchPlaceHolder="Search emojis..."
          width={size.width}
          height={size.height}
          skinTonesDisabled
          previewConfig={{ showPreview: false }}
        />
        {/* Resize handle */}
        <div
          onMouseDown={handleResizeStart}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
          style={{ touchAction: 'none' }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" className="absolute bottom-1 right-1 opacity-40">
            <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="#888" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </motion.div>
  );
};
