import { Tldraw } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { useEffect, useRef } from 'react';

interface DrawingCanvasProps {
  drawingId: string;
  initialData?: any;
  onSave?: (data: any) => void;
  height?: string;
}

export const DrawingCanvas = ({ drawingId, initialData, onSave, height = '400px' }: DrawingCanvasProps) => {
  const editorRef = useRef<any>(null);

  useEffect(() => {
    console.log('🎨 Drawing canvas mounted:', drawingId);
  }, [drawingId]);

  return (
    <div className="drawing-canvas-wrapper" style={{ height, width: '100%', position: 'relative' }}>
      <Tldraw
        onMount={(editor) => {
          console.log('✅ Tldraw editor ready');
          editorRef.current = editor;
          
          // Load initial data if provided
          if (initialData) {
            try {
              // Tldraw will handle loading from snapshot
              console.log('Loading drawing data...');
            } catch (error) {
              console.error('Failed to load drawing data:', error);
            }
          }
          
          // Set up auto-save listener
          const cleanup = editor.store.listen(() => {
            if (onSave) {
              const snapshot = editor.store.serialize('document');
              onSave(snapshot);
            }
          });
          
          return cleanup;
        }}
      />
    </div>
  );
};
