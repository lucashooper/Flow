import Image from '@tiptap/extension-image';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { GripVertical } from 'lucide-react';
import {
  getImageDropPreview,
  hideImageDropIndicator,
  moveImageWithPreview,
  showImageDropIndicator,
  type ImageDropPreview,
} from '../utils/imageDropPreview';
import { useFocusMode } from '../contexts/FocusModeContext';

type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';

const DRAG_THRESHOLD_PX = 4;

const ResizableImageComponent = (props: any) => {
  const { isFullscreen } = useFocusMode();
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const initialWidth = props.node.attrs.width as number | null;
  const [width, setWidth] = useState<number>(initialWidth || 320);
  const [height, setHeight] = useState<number>(props.node.attrs.height || 0);
  const startPos = useRef({ x: 0, y: 0 });
  const startSize = useRef({ width: 0, height: 0 });
  const resizeCorner = useRef<ResizeCorner | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const aspectRatio = useRef<number>(1);
  const hasAppliedNaturalWidth = useRef(false);
  const dragFromPos = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    hasAppliedNaturalWidth.current = false;
  }, [props.node.attrs.src]);

  // Sync dimensions when auto-fit or external updates change node attrs
  useEffect(() => {
    const attrW = props.node.attrs.width as number | null;
    const attrH = props.node.attrs.height as number | null;
    if (attrW && attrW > 0) setWidth(attrW);
    if (attrH && attrH > 0) setHeight(attrH);
  }, [props.node.attrs.width, props.node.attrs.height]);

  const handleImageLoad = () => {
    const img = imageRef.current;
    if (!img?.naturalWidth) return;

    aspectRatio.current = img.naturalWidth / img.naturalHeight;

    if (hasAppliedNaturalWidth.current) return;
    hasAppliedNaturalWidth.current = true;

    if (!initialWidth || initialWidth === 500) {
      const fitted = Math.min(img.naturalWidth, 380);
      setWidth(fitted);
      setHeight(fitted / aspectRatio.current);
      props.updateAttributes({
        width: Math.round(fitted),
        height: Math.round(fitted / aspectRatio.current),
      });
    }
  };

  const handleResizeStart = (e: React.MouseEvent, corner: ResizeCorner) => {
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    resizeCorner.current = corner;
    startPos.current = { x: e.clientX, y: e.clientY };
    startSize.current = { width, height };

    if (imageRef.current) {
      aspectRatio.current = imageRef.current.naturalWidth / imageRef.current.naturalHeight;
    }
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeCorner.current) return;

      const deltaX = e.clientX - startPos.current.x;

      let newWidth = startSize.current.width;

      switch (resizeCorner.current) {
        case 'se':
        case 'ne':
          newWidth = startSize.current.width + deltaX;
          break;
        case 'sw':
        case 'nw':
          newWidth = startSize.current.width - deltaX;
          break;
      }

      newWidth = Math.max(150, Math.min(1000, newWidth));
      const newHeight = newWidth / aspectRatio.current;

      setWidth(newWidth);
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeCorner.current = null;

      props.updateAttributes({
        width: Math.round(width),
        height: Math.round(height),
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, width, height, props]);

  const handleMoveStart = useCallback((e: React.MouseEvent) => {
    if (isFullscreen) return;
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-resize-handle]')) return;

    const fromPos = props.getPos();
    if (typeof fromPos !== 'number') {
      console.warn('[ImageDrop] drag aborted — getPos() returned', fromPos);
      return;
    }

    console.log('[ImageDrop] drag start @', fromPos, 'width=', width);

    const originX = e.clientX;
    const originY = e.clientY;
    dragFromPos.current = fromPos;
    let hasMoved = false;
    let hasHandledDrop = false; // Prevent duplicate drop handling
    let lastPreview: ImageDropPreview | null = null;
    const draggedWrapper = () =>
      wrapperRef.current?.closest('.resizable-image-wrapper') as HTMLElement | null;

    const onMove = (moveEvent: MouseEvent) => {
      if (!hasMoved) {
        const dx = moveEvent.clientX - originX;
        const dy = moveEvent.clientY - originY;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        hasMoved = true;
        setIsDragging(true);
        document.body.style.cursor = 'grabbing';
        moveEvent.preventDefault();
        console.log('[ImageDrop] threshold passed — now dragging');
      }

      lastPreview = getImageDropPreview(
        props.editor,
        moveEvent.clientX,
        moveEvent.clientY,
        fromPos,
        width,
        draggedWrapper(),
      );
      showImageDropIndicator(lastPreview);
    };

    const onUp = (upEvent: MouseEvent) => {
      if (hasHandledDrop) {
        console.log('[ImageDrop] mouseup ignored — already handled this drag');
        return;
      }
      hasHandledDrop = true;

      console.log('[ImageDrop] mouseup — hasMoved=', hasMoved, 'fromPos=', fromPos);
      
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      setIsDragging(false);
      hideImageDropIndicator();
      dragFromPos.current = null;

      if (!hasMoved) {
        console.log('[ImageDrop] drop aborted — no movement');
        props.editor.chain().focus().setNodeSelection(fromPos).run();
        return;
      }

      const preview =
        lastPreview ??
        getImageDropPreview(
          props.editor,
          upEvent.clientX,
          upEvent.clientY,
          fromPos,
          width,
          draggedWrapper(),
        );

      console.log('[ImageDrop] computed preview:', preview?.kind, preview?.label);

      if (preview) {
        console.log('[ImageDrop] drop', preview.kind, preview.label);
        moveImageWithPreview(props.editor, fromPos, preview, props.node);
      } else {
        console.warn('[ImageDrop] drop aborted — no valid preview at release');
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [props, width, isFullscreen]);

  const showEditorChrome = !isFullscreen;

  return (
    <NodeViewWrapper
      as="span"
      className={`resizable-image-wrapper${isDragging ? ' is-dragging' : ''}${showEditorChrome && props.selected ? ' ProseMirror-selectednode' : ''}`}
    >
      <span
        ref={wrapperRef}
        className="relative inline-block group align-top"
        style={{
          width: width ? `min(${width}px, 100%)` : '100%',
          userSelect: 'none',
          verticalAlign: 'top',
          cursor: showEditorChrome ? (isDragging ? 'grabbing' : 'grab') : 'default',
          opacity: isDragging ? 0.55 : 1,
        }}
        onMouseDown={showEditorChrome ? handleMoveStart : undefined}
      >
        {/* Drag affordance */}
        {showEditorChrome && (
        <span
          className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
          style={{ background: 'rgba(20,20,20,0.85)', color: 'var(--muted)' }}
          aria-hidden
        >
          <GripVertical className="w-3 h-3" />
          <span className="text-[10px]">drag</span>
        </span>
        )}

        <img
          ref={imageRef}
          src={props.node.attrs.src}
          alt={props.node.attrs.alt || ''}
          className="rounded-lg w-full h-auto select-none pointer-events-none"
          style={{
            opacity: props.node.attrs['data-uploading'] ? 0.5 : 1,
          }}
          draggable={false}
          onLoad={handleImageLoad}
        />

        {/* Resize handles */}
        {showEditorChrome && (
        <>
        <div
          data-resize-handle
          className="absolute -left-1 -top-1 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nw-resize opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          onMouseDown={(e) => handleResizeStart(e, 'nw')}
        />
        <div
          data-resize-handle
          className="absolute -right-1 -top-1 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ne-resize opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          onMouseDown={(e) => handleResizeStart(e, 'ne')}
        />
        <div
          data-resize-handle
          className="absolute -left-1 -bottom-1 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-sw-resize opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          onMouseDown={(e) => handleResizeStart(e, 'sw')}
        />
        <div
          data-resize-handle
          className="absolute -right-1 -bottom-1 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          onMouseDown={(e) => handleResizeStart(e, 'se')}
        />
        </>
        )}

        {props.node.attrs['data-uploading'] && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg pointer-events-none">
            <div className="text-white text-sm font-medium">Uploading...</div>
          </div>
        )}
      </span>
    </NodeViewWrapper>
  );
};

export const ResizableImage = Image.extend({
  name: 'resizableImage',

  inline: true,
  group: 'inline',
  atom: true,
  draggable: false,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const w = element.getAttribute('width');
          return w ? parseInt(w, 10) : null;
        },
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
      height: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const h = element.getAttribute('height');
          return h ? parseInt(h) : null;
        },
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.height) return {};
          return { height: attributes.height };
        },
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'img[src]' },
      { tag: 'span.resizable-image-wrapper img[src]' },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  },
});
