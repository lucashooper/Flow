import { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Plus } from 'lucide-react';
import { BlockInsertMenu } from './BlockInsertMenu';
import {
  getImageGutterRects,
  insertBlockBetweenImages,
  type BlockInsertAction,
} from '../utils/imageRowLayout';

interface MultiColumnGutterControlsProps {
  editor: Editor | null;
  isFullscreen: boolean;
}

interface GutterSlot {
  left: number;
  top: number;
  height: number;
  leftImagePos: number;
}

interface OpenMenu {
  x: number;
  y: number;
  leftImagePos: number;
}

export const MultiColumnGutterControls = ({
  editor,
  isFullscreen,
}: MultiColumnGutterControlsProps) => {
  const [gutters, setGutters] = useState<GutterSlot[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null);

  const refreshGutters = useCallback(() => {
    if (!editor || editor.isDestroyed || isFullscreen) {
      setGutters([]);
      return;
    }
    setGutters(getImageGutterRects(editor));
  }, [editor, isFullscreen]);

  useEffect(() => {
    if (!editor || isFullscreen) return;

    refreshGutters();

    const onUpdate = () => refreshGutters();
    editor.on('update', onUpdate);
    editor.on('selectionUpdate', onUpdate);

    const scrollParent = editor.view.dom.closest('.editor-root');
    scrollParent?.addEventListener('scroll', refreshGutters, { passive: true });
    window.addEventListener('resize', refreshGutters);

    const observer = new ResizeObserver(refreshGutters);
    observer.observe(editor.view.dom);

    return () => {
      editor.off('update', onUpdate);
      editor.off('selectionUpdate', onUpdate);
      scrollParent?.removeEventListener('scroll', refreshGutters);
      window.removeEventListener('resize', refreshGutters);
      observer.disconnect();
    };
  }, [editor, isFullscreen, refreshGutters]);

  const handleSelect = (action: BlockInsertAction) => {
    if (!editor || openMenu == null) return;
    insertBlockBetweenImages(editor, openMenu.leftImagePos, action);
  };

  if (isFullscreen || !editor || gutters.length === 0) return null;

  return (
    <>
      {gutters.map((gutter, index) => {
        const isHovered = hoveredIndex === index;
        const gutterWidth = 28;

        return (
          <div
            key={`${gutter.leftImagePos}-${gutter.left}`}
            className="fixed z-[9000] flex items-center justify-center"
            style={{
              left: gutter.left - gutterWidth / 2,
              top: gutter.top,
              width: gutterWidth,
              height: gutter.height,
              pointerEvents: 'auto',
            }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex((v) => (v === index ? null : v))}
          >
            {/* Vertical gutter line */}
            <div
              className="absolute inset-y-2 left-1/2 -translate-x-1/2 transition-opacity duration-150"
              style={{
                width: 2,
                backgroundColor: isHovered ? 'rgba(56,189,248,0.55)' : 'rgba(56,189,248,0.15)',
                borderRadius: 2,
              }}
            />

            {/* + button */}
            <button
              type="button"
              aria-label="Insert block between columns"
              onClick={() =>
                setOpenMenu({
                  x: gutter.left,
                  y: gutter.top + gutter.height / 2,
                  leftImagePos: gutter.leftImagePos,
                })
              }
              className="relative z-10 flex items-center justify-center rounded-full transition-all duration-200"
              style={{
                width: isHovered ? 22 : 18,
                height: isHovered ? 22 : 18,
                opacity: isHovered ? 1 : 0.45,
                backgroundColor: isHovered ? '#38bdf8' : 'rgba(30,30,30,0.9)',
                border: '1px solid rgba(56,189,248,0.5)',
                color: isHovered ? '#0f172a' : '#94a3b8',
                boxShadow: isHovered ? '0 0 12px rgba(56,189,248,0.45)' : 'none',
              }}
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
          </div>
        );
      })}

      {openMenu && (
        <BlockInsertMenu
          x={openMenu.x}
          y={openMenu.y}
          onSelect={handleSelect}
          onClose={() => setOpenMenu(null)}
        />
      )}
    </>
  );
};
