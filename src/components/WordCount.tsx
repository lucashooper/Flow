import { useState, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { FileText, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WordCountProps {
  editor: Editor | null;
  noteTitle?: string;
}

type TextStats = {
  words: number;
  characters: number;
  noSpaces: number;
};

function computeTextStats(text: string): TextStats {
  const characters = text.length;
  const noSpaces = text.replace(/\s+/g, '').length;
  const words = text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return { words, characters, noSpaces };
}

export const WordCount = ({ editor, noteTitle }: WordCountProps) => {
  const [pluginEnabled, setPluginEnabled] = useState(() => {
    const saved = localStorage.getItem('wordCountEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isVisible, setIsVisible] = useState(() => {
    return localStorage.getItem('wordCountVisible') === 'true';
  });
  const [documentStats, setDocumentStats] = useState<TextStats>({ words: 0, characters: 0, noSpaces: 0 });
  const [selectionStats, setSelectionStats] = useState<TextStats | null>(null);

  useEffect(() => {
    if (!editor) return;

    const updateCounts = () => {
      // Get full document text
      const fullText = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n', '\n');
      setDocumentStats(computeTextStats(fullText));
      
      // Check if there's a selection
      const { state } = editor;
      const { from, to } = state.selection;
      const hasSelection = from !== to;
      
      if (hasSelection) {
        const selectionText = state.doc.textBetween(from, to, '\n', '\n');
        setSelectionStats(computeTextStats(selectionText));
      } else {
        setSelectionStats(null);
      }
    };

    // Update on editor changes and selection changes
    editor.on('update', updateCounts);
    editor.on('selectionUpdate', updateCounts);
    
    // Initial count
    updateCounts();

    return () => {
      editor.off('update', updateCounts);
      editor.off('selectionUpdate', updateCounts);
    };
  }, [editor]);

  useEffect(() => {
    localStorage.setItem('wordCountVisible', isVisible.toString());
  }, [isVisible]);

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  useEffect(() => {
    const handler = () => toggleVisibility();
    window.addEventListener('toggleWordCount', handler as EventListener);
    return () => window.removeEventListener('toggleWordCount', handler as EventListener);
  }, []);

  // Listen for plugin state changes
  useEffect(() => {
    const handler = () => {
      const saved = localStorage.getItem('wordCountEnabled');
      setPluginEnabled(saved !== null ? JSON.parse(saved) : true);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Don't render if plugin is disabled
  if (!pluginEnabled) return null;

  return (
    <>
      {/* Word Count Panel */}
      <AnimatePresence>
        {isVisible && pluginEnabled && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-4 right-4 z-50 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2a2a]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#888888]" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-[#e5e5e5]">Statistics</span>
                  {noteTitle && (
                    <span className="text-xs text-[#666666] truncate max-w-[150px]" title={noteTitle}>
                      {noteTitle}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={toggleVisibility}
                className="p-1 hover:bg-[#252525] rounded transition-colors"
                title="Hide word count"
              >
                <X className="w-4 h-4 text-[#888888]" />
              </button>
            </div>
            
            <div className="px-3 py-2">
              {selectionStats && (
                <div className="mb-3 pb-3 border-b border-[#2a2a2a]">
                  <div className="text-xs font-semibold text-[#e5e5e5] mb-2">Selection</div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-8">
                      <span className="text-xs text-[#888888]">Words</span>
                      <span className="text-sm font-semibold text-[#e5e5e5] tabular-nums">
                        {selectionStats.words.toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between gap-8">
                      <span className="text-xs text-[#888888]">Characters</span>
                      <span className="text-sm font-medium text-[#a5a5a5] tabular-nums">
                        {selectionStats.characters.toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between gap-8">
                      <span className="text-xs text-[#888888]">No spaces</span>
                      <span className="text-sm font-medium text-[#a5a5a5] tabular-nums">
                        {selectionStats.noSpaces.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              <div>
                {selectionStats && (
                  <div className="text-xs font-semibold text-[#e5e5e5] mb-2">Document</div>
                )}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-8">
                    <span className="text-xs text-[#888888]">Words</span>
                    <span className="text-sm font-semibold text-[#e5e5e5] tabular-nums">
                      {documentStats.words.toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between gap-8">
                    <span className="text-xs text-[#888888]">Characters</span>
                    <span className="text-sm font-medium text-[#a5a5a5] tabular-nums">
                      {documentStats.characters.toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between gap-8">
                    <span className="text-xs text-[#888888]">No spaces</span>
                    <span className="text-sm font-medium text-[#a5a5a5] tabular-nums">
                      {documentStats.noSpaces.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
