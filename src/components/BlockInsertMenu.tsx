import { motion, AnimatePresence } from 'framer-motion';
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  List,
  CheckSquare,
  Code,
  Image,
  X,
} from 'lucide-react';
import type { BlockInsertAction } from '../utils/imageRowLayout';

interface BlockInsertMenuProps {
  x: number;
  y: number;
  onSelect: (action: BlockInsertAction) => void;
  onClose: () => void;
}

const ITEMS: Array<{ action: BlockInsertAction; label: string; icon: typeof Type; hint?: string }> = [
  { action: 'text', label: 'Text', icon: Type, hint: 'Inline between columns' },
  { action: 'heading1', label: 'Heading 1', icon: Heading1, hint: '# ' },
  { action: 'heading2', label: 'Heading 2', icon: Heading2, hint: '## ' },
  { action: 'heading3', label: 'Heading 3', icon: Heading3, hint: '### ' },
  { action: 'blockquote', label: 'Blockquote', icon: Quote },
  { action: 'bulletList', label: 'Bulleted list', icon: List },
  { action: 'taskList', label: 'To-do list', icon: CheckSquare },
  { action: 'code', label: 'Code block', icon: Code },
  { action: 'image', label: 'Image', icon: Image },
];

export const BlockInsertMenu = ({ x, y, onSelect, onClose }: BlockInsertMenuProps) => {
  const menuWidth = 260;
  const left = Math.min(x - menuWidth / 2, window.innerWidth - menuWidth - 12);
  const top = Math.min(y + 12, window.innerHeight - 360);

  return (
    <>
      <div className="fixed inset-0 z-[10000]" onClick={onClose} aria-hidden />
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: -4 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          className="fixed z-[10001] rounded-xl shadow-2xl overflow-hidden"
          style={{
            left: Math.max(12, left),
            top: Math.max(12, top),
            width: menuWidth,
            backgroundColor: 'var(--bg-elev, #1a1a1a)',
            border: '1px solid var(--border, #2a2a2a)',
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-2 border-b"
            style={{ borderColor: 'var(--border, #2a2a2a)' }}
          >
            <span className="text-xs font-semibold" style={{ color: 'var(--muted, #888)' }}>
              Insert block
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-white/5"
              style={{ color: 'var(--muted, #888)' }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {ITEMS.map(({ action, label, icon: Icon, hint }) => (
              <button
                key={action}
                type="button"
                onClick={() => {
                  onSelect(action);
                  onClose();
                }}
                className="w-full px-3 py-2 flex items-center gap-3 text-left text-sm hover:bg-white/5 transition-colors"
                style={{ color: 'var(--text, #e5e5e5)' }}
              >
                <Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--muted, #888)' }} />
                <span className="flex-1">{label}</span>
                {hint && (
                  <span className="text-[10px]" style={{ color: 'var(--muted, #666)' }}>
                    {hint}
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
};
