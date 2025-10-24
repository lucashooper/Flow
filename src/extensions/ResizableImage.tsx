import Image from '@tiptap/extension-image';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { useState, useRef, useEffect } from 'react';

type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';

const ResizableImageComponent = (props: any) => {
  const [isResizing, setIsResizing] = useState(false);
  const [width, setWidth] = useState<number>(props.node.attrs.width || 500);
  const [height, setHeight] = useState<number>(props.node.attrs.height || 0);
  const startPos = useRef({ x: 0, y: 0 });
  const startSize = useRef({ width: 0, height: 0 });
  const resizeCorner = useRef<ResizeCorner | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const aspectRatio = useRef<number>(1);

  // Calculate aspect ratio on mount
  useEffect(() => {
    if (imageRef.current && imageRef.current.naturalWidth) {
      aspectRatio.current = imageRef.current.naturalWidth / imageRef.current.naturalHeight;
    }
  }, [props.node.attrs.src]);

  const handleResizeStart = (e: React.MouseEvent, corner: ResizeCorner) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    resizeCorner.current = corner;
    startPos.current = { x: e.clientX, y: e.clientY };
    startSize.current = { width, height };
    
    // Get current aspect ratio
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
      let newHeight = startSize.current.height;

      // Calculate new dimensions based on corner
      switch (resizeCorner.current) {
        case 'se': // Bottom-right
          newWidth = startSize.current.width + deltaX;
          break;
        case 'sw': // Bottom-left
          newWidth = startSize.current.width - deltaX;
          break;
        case 'ne': // Top-right
          newWidth = startSize.current.width + deltaX;
          break;
        case 'nw': // Top-left
          newWidth = startSize.current.width - deltaX;
          break;
      }

      // Maintain aspect ratio
      newWidth = Math.max(150, Math.min(1000, newWidth));
      newHeight = newWidth / aspectRatio.current;
      
      setWidth(newWidth);
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeCorner.current = null;
      
      // Update the node attributes
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

  return (
    <NodeViewWrapper 
      className="resizable-image-wrapper" 
      style={{ display: 'block', margin: '1rem 0' }}
      data-drag-handle
    >
      <div
        className="relative inline-block group"
        style={{
          width: `${width}px`,
          maxWidth: '100%',
          userSelect: 'none',
        }}
      >
        <img
          ref={imageRef}
          src={props.node.attrs.src}
          alt={props.node.attrs.alt || ''}
          className="rounded-lg w-full h-auto select-none"
          style={{
            pointerEvents: isResizing ? 'none' : 'auto',
            opacity: props.node.attrs['data-uploading'] ? 0.5 : 1,
          }}
          draggable={false}
        />
        
        {/* Resize Handle - Top-Left (nw-resize) */}
        <div
          className="absolute -left-1 -top-1 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nw-resize opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          onMouseDown={(e) => handleResizeStart(e, 'nw')}
          style={{ pointerEvents: 'auto' }}
        />
        
        {/* Resize Handle - Top-Right (ne-resize) */}
        <div
          className="absolute -right-1 -top-1 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ne-resize opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          onMouseDown={(e) => handleResizeStart(e, 'ne')}
          style={{ pointerEvents: 'auto' }}
        />
        
        {/* Resize Handle - Bottom-Left (sw-resize) */}
        <div
          className="absolute -left-1 -bottom-1 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-sw-resize opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          onMouseDown={(e) => handleResizeStart(e, 'sw')}
          style={{ pointerEvents: 'auto' }}
        />
        
        {/* Resize Handle - Bottom-Right (se-resize) */}
        <div
          className="absolute -right-1 -bottom-1 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          onMouseDown={(e) => handleResizeStart(e, 'se')}
          style={{ pointerEvents: 'auto' }}
        />

        {/* Loading indicator */}
        {props.node.attrs['data-uploading'] && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg">
            <div className="text-white text-sm font-medium">Uploading...</div>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};

export const ResizableImage = Image.extend({
  name: 'resizableImage',

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: 500,
        parseHTML: (element) => {
          const width = element.getAttribute('width');
          return width ? parseInt(width) : 500;
        },
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
      height: {
        default: null,
        parseHTML: (element) => {
          const height = element.getAttribute('height');
          return height ? parseInt(height) : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.height) return {};
          return { height: attributes.height };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  },
});
