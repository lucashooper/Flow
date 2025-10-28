import { NodeViewWrapper } from '@tiptap/react';
import { DrawingCanvas } from '../components/DrawingCanvas';
import { useState } from 'react';
import { Pencil, Trash2, Maximize2, Minimize2 } from 'lucide-react';

export const DrawingNodeView = ({ node, updateAttributes, deleteNode }: any) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (data: any) => {
    setIsSaving(true);
    
    // Update node attributes with drawing data
    updateAttributes({ drawingData: data });
    
    // TODO: Save to Supabase in production
    console.log('💾 Drawing saved:', node.attrs.drawingId);
    
    setTimeout(() => setIsSaving(false), 500);
  };

  const height = isExpanded ? '800px' : node.attrs.height || '400px';

  return (
    <NodeViewWrapper className="drawing-node">
      <div className="drawing-container border border-[#2a2a2a] rounded-lg overflow-hidden my-4 bg-[#1a1a1a]">
        {/* Toolbar */}
        <div className="drawing-toolbar flex items-center justify-between bg-[#0a0a0a] px-4 py-2 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-purple-400" />
            <span className="text-sm text-[#e5e5e5]">Drawing Canvas</span>
            {isSaving && (
              <span className="text-xs text-[#888888]">Saving...</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 hover:bg-[#252525] rounded transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4 text-[#e5e5e5]" />
              ) : (
                <Maximize2 className="h-4 w-4 text-[#e5e5e5]" />
              )}
            </button>
            <button
              onClick={deleteNode}
              className="p-1.5 hover:bg-red-600 rounded transition-colors"
              title="Delete drawing"
            >
              <Trash2 className="h-4 w-4 text-[#e5e5e5]" />
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="drawing-canvas-container">
          <DrawingCanvas
            drawingId={node.attrs.drawingId}
            initialData={node.attrs.drawingData}
            onSave={handleSave}
            height={height}
          />
        </div>
      </div>
    </NodeViewWrapper>
  );
};
