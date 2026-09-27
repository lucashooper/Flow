import Image from '@tiptap/extension-image';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { destroyImageDropOverlay } from '../utils/imageDropPreview';
import {
  createPointerGhost,
  endPointerDragSession,
  isPointerDragActive,
  startPointerDragSession,
} from '../utils/imageDragSession';
import { stripStrayDragTextNodes } from '../utils/imageSanitize';
import { getRowImagesAtPos, resizeImageInRow } from '../utils/imageRowLayout';
import { useFocusMode } from '../contexts/FocusModeContext';

const DRAG_THRESHOLD_PX = 5;

const ResizableImageComponent = (props: any) => {
  const { isFullscreen } = useFocusMode();
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const initialWidth = props.node.attrs.width as number | null;
  const [width, setWidth] = useState<number>(initialWidth || 320);
  const [height, setHeight] = useState<number>(props.node.attrs.height || 0);
  const startPos = useRef({ x: 0, y: 0 });
  const startSize = useRef({ width: 0, height: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const aspectRatio = useRef<number>(1);
  const hasAppliedNaturalWidth = useRef(false);
  const innerRef = useRef<HTMLSpanElement>(null);
  const liveWidth = useRef(width);
  const pointerCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    liveWidth.current = width;
  }, [width]);

  useEffect(() => {
    hasAppliedNaturalWidth.current = false;
  }, [props.node.attrs.src]);

  useEffect(() => {
    const attrW = props.node.attrs.width as number | null;
    const attrH = props.node.attrs.height as number | null;
    if (attrW && attrW > 0) setWidth(attrW);
    if (attrH && attrH > 0) setHeight(attrH);
  }, [props.node.attrs.width, props.node.attrs.height]);

  const isInMultiColumnRow = useCallback(() => {
    const fromPos = props.getPos();
    if (typeof fromPos !== 'number') return false;
    const row = getRowImagesAtPos(props.editor.view, fromPos);
    return (row?.images.length ?? 0) > 1;
  }, [props]);

  const getWrapperEl = useCallback(
    () => innerRef.current?.closest('.resizable-image-wrapper') as HTMLElement | null,
    [],
  );

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

  const commitWidth = useCallback(
    (newWidth: number) => {
      const fromPos = props.getPos();
      if (typeof fromPos !== 'number') return;

      if (isInMultiColumnRow()) {
        resizeImageInRow(props.editor, fromPos, newWidth);
      } else {
        const newHeight = newWidth / aspectRatio.current;
        props.updateAttributes({
          width: Math.round(newWidth),
          height: Math.round(newHeight),
        });
      }
    },
    [props, isInMultiColumnRow],
  );

  const handleEdgeResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    startPos.current = { x: e.clientX, y: e.clientY };
    startSize.current = { width, height };

    if (imageRef.current) {
      aspectRatio.current = imageRef.current.naturalWidth / imageRef.current.naturalHeight;
    }
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startPos.current.x;
      let newWidth = startSize.current.width + deltaX;
      newWidth = Math.max(120, Math.min(1000, newWidth));

      const newHeight = newWidth / aspectRatio.current;
      setWidth(newWidth);
      setHeight(newHeight);
      liveWidth.current = newWidth;
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      commitWidth(liveWidth.current);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, commitWidth]);

  const finishLocalDragUi = useCallback(() => {
    setIsDragging(false);
    destroyImageDropOverlay();
    document.body.classList.remove('flow-image-dragging');
    document.body.style.cursor = '';
    requestAnimationFrame(() => stripStrayDragTextNodes(props.editor));
  }, [props.editor]);

  /** Pointer drag — single path, no HTML5 draggable (avoids "drag" text leaks in CE). */
  const handlePointerDown = useCallback(
    (e: React.MouseEvent) => {
      if (isFullscreen || isResizing || isPointerDragActive()) return;
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest('[data-resize-handle]')) return;

      const fromPos = props.getPos();
      if (typeof fromPos !== 'number') return;

      const wrapper = getWrapperEl();
      if (!wrapper) return;

      const originX = e.clientX;
      const originY = e.clientY;
      let dragStarted = false;

      const cleanupListeners = () => {
        document.removeEventListener('mousemove', onMove, true);
        document.removeEventListener('mouseup', onUp, true);
        pointerCleanupRef.current = null;
      };

      const onMove = (moveEvent: MouseEvent) => {
        if (dragStarted) return;

        const dx = moveEvent.clientX - originX;
        const dy = moveEvent.clientY - originY;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

        dragStarted = true;
        moveEvent.preventDefault();
        moveEvent.stopPropagation();

        console.log('[DragStart]', {
          fromPos,
          width,
          mode: 'pointer',
          clientX: moveEvent.clientX,
          clientY: moveEvent.clientY,
        });

        const { ghost, offsetX, offsetY } = createPointerGhost(wrapper);
        setIsDragging(true);

        startPointerDragSession({
          editor: props.editor,
          fromPos,
          node: props.node,
          width,
          draggedEl: wrapper,
          ghost,
          ghostOffsetX: offsetX,
          ghostOffsetY: offsetY,
          onFinish: finishLocalDragUi,
        });

        cleanupListeners();
      };

      const onUp = (upEvent: MouseEvent) => {
        cleanupListeners();
        if (!dragStarted) {
          props.editor.chain().focus().setNodeSelection(fromPos).run();
          return;
        }
        upEvent.preventDefault();
      };

      pointerCleanupRef.current = cleanupListeners;
      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('mouseup', onUp, true);
    },
    [props, width, isFullscreen, isResizing, getWrapperEl, finishLocalDragUi],
  );

  useEffect(
    () => () => {
      pointerCleanupRef.current?.();
      endPointerDragSession();
      destroyImageDropOverlay();
      document.body.classList.remove('flow-image-dragging');
      document.body.style.cursor = '';
    },
    [],
  );

  const showEditorChrome = !isFullscreen;
  const isSelected = showEditorChrome && props.selected;

  return (
    <NodeViewWrapper
      as="span"
      className={`resizable-image-wrapper${isDragging ? ' is-dragging' : ''}${isSelected ? ' ProseMirror-selectednode is-selected' : ''}`}
      style={{
        display: 'inline-block',
        width: 'fit-content',
        maxWidth: '100%',
        verticalAlign: 'top',
        transition: isResizing || isDragging ? 'none' : 'width 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <span
        ref={innerRef}
        className="relative inline-block group align-top flow-image-inner"
        style={{
          width: width ? `${width}px` : 'auto',
          maxWidth: '100%',
          userSelect: 'none',
          verticalAlign: 'top',
          cursor: showEditorChrome ? (isDragging ? 'grabbing' : 'grab') : 'default',
          opacity: isDragging ? 0.45 : 1,
          transition: isResizing || isDragging ? 'none' : 'width 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onMouseDown={showEditorChrome ? handlePointerDown : undefined}
      >
        <img
          ref={imageRef}
          src={props.node.attrs.src}
          alt={props.node.attrs.alt || ''}
          className="rounded-md w-full h-auto select-none flow-image-media"
          style={{
            opacity: props.node.attrs['data-uploading'] ? 0.5 : 1,
            borderRadius: 6,
            pointerEvents: isDragging ? 'none' : 'auto',
          }}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          onLoad={handleImageLoad}
        />

        {showEditorChrome && (
          <>
            <div
              data-resize-handle
              className="flow-resize-pill flow-resize-pill-left"
              onMouseDown={handleEdgeResizeStart}
            />
            <div
              data-resize-handle
              className="flow-resize-pill flow-resize-pill-right"
              onMouseDown={handleEdgeResizeStart}
            />
          </>
        )}

        {props.node.attrs['data-uploading'] && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-md pointer-events-none">
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

  onCreate() {
    requestAnimationFrame(() => stripStrayDragTextNodes(this.editor));
  },

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
          return h ? parseInt(h, 10) : null;
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
