import { useState, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { FileText, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WordCountProps {
  editor: Editor | null;
}

export const WordCount = ({ editor }: WordCountProps) => {
  const [isVisible, setIsVisible] = useState(() => {
    return localStorage.getItem('wordCountVisible') === 'true';
  });
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [charCountNoSpaces, setCharCountNoSpaces] = useState(0);

  useEffect(() => {
    if (!editor) return;

    const updateCounts = () => {
      const text = editor.getText();
      
      // Word count - split by whitespace and filter empty strings
      const words = text.trim().split(/\s+/).filter(word => word.length > 0);
      setWordCount(words.length);
      
      // Character count with spaces
      setCharCount(text.length);
      
      // Character count without spaces
      setCharCountNoSpaces(text.replace(/\s/g, '').length);
    };

    // Update on editor changes
    editor.on('update', updateCounts);
    
    // Initial count
    updateCounts();

    return () => {
      editor.off('update', updateCounts);
    };
  }, [editor]);

  useEffect(() => {
    localStorage.setItem('wordCountVisible', isVisible.toString());
  }, [isVisible]);

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  return (
    <>
      {/* Toggle Button */}
      {!isVisible && (
        <button
          onClick={toggleVisibility}
          className="fixed top-4 right-4 z-50 p-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg hover:bg-[#252525] transition-colors shadow-lg"
          title="Show word count"
        >
          <FileText className="w-5 h-5 text-[#888888]" />
        </button>
      )}

      {/* Word Count Panel */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-4 right-4 z-50 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2a2a]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#888888]" />
                <span className="text-sm font-medium text-[#e5e5e5]">Statistics</span>
              </div>
              <button
                onClick={toggleVisibility}
                className="p-1 hover:bg-[#252525] rounded transition-colors"
                title="Hide word count"
              >
                <X className="w-4 h-4 text-[#888888]" />
              </button>
            </div>
            
            <div className="px-3 py-2 space-y-1.5">
              <div className="flex items-center justify-between gap-8">
                <span className="text-xs text-[#888888]">Words</span>
                <span className="text-sm font-semibold text-[#e5e5e5] tabular-nums">
                  {wordCount.toLocaleString()}
                </span>
              </div>
              
              <div className="flex items-center justify-between gap-8">
                <span className="text-xs text-[#888888]">Characters</span>
                <span className="text-sm font-medium text-[#a5a5a5] tabular-nums">
                  {charCount.toLocaleString()}
                </span>
              </div>
              
              <div className="flex items-center justify-between gap-8">
                <span className="text-xs text-[#888888]">No spaces</span>
                <span className="text-sm font-medium text-[#a5a5a5] tabular-nums">
                  {charCountNoSpaces.toLocaleString()}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
