import Image from '@tiptap/extension-image';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { useState, useRef, useEffect } from 'react';

const ResizableImageComponent = (props: any) => {
  const [isResizing, setIsResizing] = useState(false);
  const [width, setWidth] = useState<number>(
    props.node.attrs.width || 400
  );
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);

  const handleMouseDown = (e: React.MouseEvent, direction: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startX.current = e.clientX;
    startWidth.current = width;
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX.current;
      const newWidth = Math.max(100, Math.min(800, startWidth.current + diff));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      // Update the node attrs
      props.updateAttributes({
        width,
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, width, props]);

  return (
    <NodeViewWrapper className="resizable-image-wrapper" style={{ display: 'inline-block' }}>
      <div
        className="relative inline-block group"
        style={{
          width: `${width}px`,
          maxWidth: '100%',
        }}
      >
        <img
          src={props.node.attrs.src}
          alt={props.node.attrs.alt || ''}
          className="rounded-lg my-4 w-full h-auto"
          style={{
            pointerEvents: isResizing ? 'none' : 'auto',
          }}
        />
        
        {/* Resize Handle - Left */}
        <div
          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
          onMouseDown={(e) => handleMouseDown(e, 'left')}
          style={{
            background: 'linear-gradient(to right, rgba(217, 119, 6, 0.5), transparent)',
          }}
        />
        
        {/* Resize Handle - Right */}
        <div
          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
          onMouseDown={(e) => handleMouseDown(e, 'right')}
          style={{
            background: 'linear-gradient(to left, rgba(217, 119, 6, 0.5), transparent)',
          }}
        />
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
        default: 400,
        parseHTML: (element) => element.getAttribute('width'),
        renderHTML: (attributes) => {
          return {
            width: attributes.width,
          };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  },
});
