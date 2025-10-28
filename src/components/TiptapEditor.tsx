import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { ResizableImage } from '../extensions/ResizableImage.tsx';
import { FontSize } from '../extensions/FontSize';
import { ImagePaste } from '../extensions/ImagePaste';
import { ColoredBold } from '../extensions/ColoredBold';
import { QuoteMark } from '../extensions/QuoteMark';
import { DrawingNode } from '../extensions/DrawingNode';
import 'prosemirror-view/style/prosemirror.css';
import { Bold, Italic, Code, Link as LinkIcon, Minus, Plus, Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ContextMenu } from './ContextMenu';
import { PersistentDrawingLayer } from './PersistentDrawingLayer';
import { supabase } from '../lib/supabase';
import { isWordCorrect, getSpellingSuggestions, initSpellChecker } from '../utils/spellcheck';

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  drawingData?: string;
  onDrawingChange?: (data: string) => void;
  placeholder?: string;
}

export const TiptapEditor = ({ content, onChange, drawingData: initialDrawingData, onDrawingChange, placeholder }: TiptapEditorProps) => {
  const [showBubbleMenu, setShowBubbleMenu] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; text: string; misspelledWord?: string; suggestions?: string[] } | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);

  // Initialize spell checker on mount
  useEffect(() => {
    console.log('🔤 Initializing spell checker...');
    initSpellChecker().then(() => {
      console.log('✅ Spell checker ready!');
    }).catch((err) => {
      console.error('❌ Spell checker failed to load:', err);
    });
  }, []);
  const [defaultBoldColor, setDefaultBoldColor] = useState<string>(() => {
    return localStorage.getItem('defaultBoldColor') || '';
  });
  const [bulletStyle, setBulletStyle] = useState<string>(() => {
    return localStorage.getItem('bulletStyle') || 'gray';
  });
  const [quoteStyle, setQuoteStyle] = useState<string>(() => {
    return localStorage.getItem('quoteStyle') || 'default';
  });

  // Handle image upload to Supabase
  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('note-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('note-images')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        bold: false, // Disable default bold to use our custom one
        link: false, // Disable built-in link to avoid duplicates
      }),
      ColoredBold,
      QuoteMark,
      DrawingNode,
      Placeholder.configure({
        placeholder: placeholder || 'Start writing...',
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      Subscript,
      Superscript,
      FontSize,
      ResizableImage.configure({
        inline: false,
        allowBase64: true,
      }),
      ImagePaste.configure({
        uploadImage,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-[#D97706] underline cursor-pointer',
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-full',
        style: 'line-height: 1.7; color: #e5e5e5; max-width: 800px; margin: 0 auto; padding: 1.5rem 2rem; width: 100%;',
        spellcheck: 'true',
      },
    },
  });

  // Update editor content when prop changes (for switching notes)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Add keyboard shortcut to jump back to title
  useEffect(() => {
    if (editor) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowUp') {
          e.preventDefault();
          const titleInput = document.querySelector('input[placeholder="Untitled"]') as HTMLInputElement;
          if (titleInput) {
            titleInput.focus();
            titleInput.select();
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [editor]);

  // Listen for bullet style changes
  useEffect(() => {
    const handleBulletStyleChange = (e: CustomEvent) => {
      setBulletStyle(e.detail);
    };

    window.addEventListener('bulletStyleChanged', handleBulletStyleChange as EventListener);
    return () => window.removeEventListener('bulletStyleChanged', handleBulletStyleChange as EventListener);
  }, []);

  // Listen for quote style changes
  useEffect(() => {
    const handleQuoteStyleChange = (e: CustomEvent) => {
      setQuoteStyle(e.detail);
    };

    window.addEventListener('quoteStyleChanged', handleQuoteStyleChange as EventListener);
    return () => window.removeEventListener('quoteStyleChanged', handleQuoteStyleChange as EventListener);
  }, []);

  // Debug: Verify QuoteMark extension is loaded
  useEffect(() => {
    if (editor) {
      console.log('=== EDITOR DEBUG ===');
      console.log('All extensions:', editor.extensionManager.extensions.map(ext => ext.name));
      console.log('QuoteMark loaded?', editor.extensionManager.extensions.some(ext => ext.name === 'quoteMark'));
      console.log('Available commands:', Object.keys(editor.commands));
      console.log('Current quote style:', localStorage.getItem('quoteStyle'));
      console.log('Current bullet style:', localStorage.getItem('bulletStyle'));
      console.log('Current bold color:', localStorage.getItem('defaultBoldColor'));
    }
  }, [editor]);


  if (!editor) {
    return null;
  }

  const setLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  useEffect(() => {
    if (editor) {
      const handleSelectionUpdate = () => {
        const { from, to } = editor.state.selection;
        setShowBubbleMenu(from !== to);
      };

      editor.on('selectionUpdate', handleSelectionUpdate);
      return () => {
        editor.off('selectionUpdate', handleSelectionUpdate);
      };
    }
  }, [editor]);

  const handleContextMenu = async (e: React.MouseEvent) => {
    // Only prevent default if clicking inside the editor content area
    const target = e.target as HTMLElement;
    const isEditorContent = target.closest('.ProseMirror') || target.classList.contains('ProseMirror');
    
    if (!isEditorContent) {
      // Allow default context menu for non-editor areas (sidebar, etc.)
      return;
    }
    
    e.preventDefault();
    if (!editor) return;

    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');

    // Show menu immediately
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      text: selectedText,
      misspelledWord: undefined,
      suggestions: [],
    });

    // Check spelling asynchronously (non-blocking)
    // Get word at cursor even if nothing is selected
    setTimeout(() => {
      let wordToCheck = selectedText?.trim();
      
      // If no selection, get word at cursor position
      if (!wordToCheck || wordToCheck.length === 0) {
        const pos = editor.state.selection.from;
        const $pos = editor.state.doc.resolve(pos);
        const textNode = $pos.parent.textContent;
        const offset = $pos.parentOffset;
        
        // Find word boundaries
        let start = offset;
        let end = offset;
        
        while (start > 0 && /\w/.test(textNode[start - 1])) start--;
        while (end < textNode.length && /\w/.test(textNode[end])) end++;
        
        wordToCheck = textNode.substring(start, end);
      }
      
      // Take first word if multiple words selected
      const wordAtCursor = wordToCheck?.split(/\s+/)[0];
      console.log('🔍 Checking spelling for:', wordAtCursor);
      
      if (wordAtCursor && wordAtCursor.length > 0) {
        const isCorrect = isWordCorrect(wordAtCursor);
        console.log('📝 Word correct?', isCorrect);
        if (!isCorrect) {
          const suggestions = getSpellingSuggestions(wordAtCursor);
          console.log('💡 Suggestions:', suggestions);
          setContextMenu(prev => prev ? {
            ...prev,
            misspelledWord: wordAtCursor,
            suggestions: suggestions
          } : null);
        }
      }
    }, 0);
  };

  const increaseFontSize = () => {
    if (!editor) return;
    const currentSize = editor.getAttributes('textStyle').fontSize || '1rem';
    const sizeValue = parseFloat(currentSize);
    const newSize = `${sizeValue + 0.125}rem`;
    editor.chain().focus().setFontSize(newSize).run();
  };

  const decreaseFontSize = () => {
    if (!editor) return;
    const currentSize = editor.getAttributes('textStyle').fontSize || '1rem';
    const sizeValue = parseFloat(currentSize);
    const newSize = `${Math.max(0.5, sizeValue - 0.125)}rem`;
    editor.chain().focus().setFontSize(newSize).run();
  };

  // Handle ESC key to exit drawing mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawingMode) {
        setIsDrawingMode(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isDrawingMode]);

  return (
    <div className={`h-full flex flex-col bg-[#0a0a0a] relative editor-bullets-${bulletStyle} editor-quote-${quoteStyle}`} onContextMenu={handleContextMenu}>
      {/* Persistent Drawing Layer */}
      <PersistentDrawingLayer
        isDrawingMode={isDrawingMode}
        onExitDrawingMode={() => setIsDrawingMode(false)}
        drawingData={initialDrawingData || ''}
        onDrawingChange={(data) => {
          if (onDrawingChange) {
            onDrawingChange(data);
            console.log('✏️ Drawing auto-saved to database');
          }
        }}
      />

      {/* Floating Drawing Button - Always Visible */}
      <button
        onClick={() => setIsDrawingMode(true)}
        className="fixed bottom-8 right-8 z-40 p-4 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-2xl transition-all hover:scale-110"
        title="Start Drawing Mode (Draw anywhere!)"
      >
        <Pencil className="w-6 h-6" />
      </button>

      {/* Bubble Menu - appears on text selection */}
      {editor && showBubbleMenu && (
        <div className="absolute z-50 flex items-center gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl p-1"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'auto',
          }}
        >
          {/* Font Size Controls */}
          <button
            onClick={decreaseFontSize}
            className="p-2 rounded transition-colors text-[#e5e5e5] hover:bg-[#252525]"
            title="Decrease Font Size"
          >
            <Minus className="w-4 h-4" />
          </button>

          <button
            onClick={increaseFontSize}
            className="p-2 rounded transition-colors text-[#e5e5e5] hover:bg-[#252525]"
            title="Increase Font Size"
          >
            <Plus className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-[#2a2a2a] mx-1" />

          <button
            onClick={() => {
              const wasBold = editor.isActive('bold');
              const boldColor = localStorage.getItem('defaultBoldColor');
              
              // Toggle bold
              editor.chain().focus().toggleBold().run();
              
              // If we just made it bold, apply color
              if (!wasBold && boldColor) {
                editor.chain().focus().setColor(boldColor).run();
              }
            }}
            className={`p-2 rounded transition-colors ${
              editor.isActive('bold')
                ? 'bg-[#A0522D] text-white'
                : 'text-[#e5e5e5] hover:bg-[#252525]'
            }`}
            title="Bold (Cmd/Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </button>

          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-2 rounded transition-colors ${
              editor.isActive('italic')
                ? 'bg-[#A0522D] text-white'
                : 'text-[#e5e5e5] hover:bg-[#252525]'
            }`}
            title="Italic (Cmd/Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </button>

          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`p-2 rounded transition-colors ${
              editor.isActive('code')
                ? 'bg-[#A0522D] text-white'
                : 'text-[#e5e5e5] hover:bg-[#252525]'
            }`}
            title="Code (Cmd/Ctrl+`)"
          >
            <Code className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-[#2a2a2a] mx-1" />

          <button
            onClick={setLink}
            className={`p-2 rounded transition-colors ${
              editor.isActive('link')
                ? 'bg-[#A0522D] text-white'
                : 'text-[#e5e5e5] hover:bg-[#252525]'
            }`}
            title="Add Link (Cmd/Ctrl+K)"
          >
            <LinkIcon className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-[#2a2a2a] mx-1" />

          <button
            onClick={() => {
              const drawingId = crypto.randomUUID();
              editor.commands.insertContent({
                type: 'drawing',
                attrs: { drawingId },
              });
            }}
            className="p-2 rounded transition-colors text-[#e5e5e5] hover:bg-[#252525]"
            title="Insert Drawing Canvas (Cmd/Ctrl+Shift+D)"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          editor={editor}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          selectedText={contextMenu.text}
          misspelledWord={contextMenu.misspelledWord}
          suggestions={contextMenu.suggestions}
          onStartDrawing={() => setIsDrawingMode(true)}
        />
      )}

      {/* Editor */}
      <EditorContent 
        editor={editor} 
        className="h-full overflow-y-auto prose prose-invert max-w-none editor-scrollbar"
        style={{ 
          maxWidth: '800px', 
          margin: '0 auto',
          padding: '2rem',
          paddingBottom: '50vh', // Large bottom padding for breathing room
          width: '100%'
        }}
      />

      <style>{`
        /* Hide scrollbar but keep functionality */
        .editor-scrollbar::-webkit-scrollbar {
          width: 0px;
          background: transparent;
        }
        .editor-scrollbar {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE/Edge */
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #0a0a0a;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2a2a2a;
          border-radius: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3a3a3a;
        }
        
        /* Remove blue border from images */
        .ProseMirror img {
          outline: none !important;
          border: none !important;
        }
        .ProseMirror img.ProseMirror-selectednode {
          outline: 2px solid #A0522D !important;
          border-radius: 8px;
        }
        .ProseMirror img:focus {
          outline: none !important;
        }
        
        /* Make images resizable by dragging */
        .ProseMirror img {
          cursor: nwse-resize;
          position: relative;
        }
        .ProseMirror img:hover {
          box-shadow: 0 0 0 2px #A0522D40;
        }
        
        /* Tiptap Styles */
        .ProseMirror {
          min-height: 100%;
        }

        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #666666;
          pointer-events: none;
          height: 0;
        }

        .ProseMirror h1 {
          font-size: 2.5rem;
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          background: linear-gradient(135deg, #a855f7, #9333ea);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.02em;
          border-bottom: 2px solid #2a2a2a;
          padding-bottom: 0.5rem;
        }

        .ProseMirror h2 {
          font-size: 2rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          color: #f59e0b;
          letter-spacing: -0.01em;
        }

        .ProseMirror h3 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          color: #06b6d4;
          letter-spacing: -0.01em;
        }

        .ProseMirror h4 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          color: #9ca3af;
        }

        .ProseMirror h5 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-top: 0.75rem;
          margin-bottom: 0.5rem;
          color: #9ca3af;
        }

        .ProseMirror h6 {
          font-size: 1rem;
          font-weight: 600;
          margin-top: 0.75rem;
          margin-bottom: 0.5rem;
          color: #9ca3af;
        }

        .ProseMirror code {
          background: #1a1a1a;
          color: #e5e5e5;
          padding: 0.2em 0.4em;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
        }

        .ProseMirror pre {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 5px;
          padding: 1em;
          overflow-x: auto;
        }

        .ProseMirror pre code {
          background: none;
          padding: 0;
        }

        .ProseMirror blockquote {
          border-left: 3px solid #A0522D;
          padding-left: 1em;
          color: #888888;
          margin-left: 0;
        }

        .ProseMirror ul, .ProseMirror ol {
          padding-left: 1.5em;
        }

        .ProseMirror ul[data-type="taskList"] {
          list-style: none;
          padding-left: 0;
        }

        .ProseMirror ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 0.5em;
        }

        .ProseMirror ul[data-type="taskList"] li input[type="checkbox"] {
          margin-top: 0.3em;
          cursor: pointer;
        }

        .ProseMirror a {
          color: #D97706;
          text-decoration: underline;
          cursor: pointer;
        }

        .ProseMirror a:hover {
          color: #A0522D;
        }

        .ProseMirror strong {
          font-weight: bold;
        }

        .ProseMirror em {
          font-style: italic;
        }

        .ProseMirror mark {
          padding: 0.125em 0.25em;
          border-radius: 0.25em;
          transition: background-color 100ms ease;
        }

        .ProseMirror u {
          text-decoration: underline;
          text-decoration-color: #A0522D;
          text-decoration-thickness: 2px;
        }

        /* Smooth color transitions */
        .ProseMirror * {
          transition: color 100ms ease, background-color 100ms ease;
        }

        /* Ensure bullets are visible */
        .ProseMirror ul {
          list-style-type: disc;
          padding-left: 1.5rem;
        }

        .ProseMirror ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
        }

        /* Bullet Style Colors - Using ::marker for proper styling */
        .editor-bullets-gray .ProseMirror ul li::marker {
          color: #888888;
        }
        .editor-bullets-gray .ProseMirror ol li::marker {
          color: #888888;
        }

        .editor-bullets-purple .ProseMirror ul li::marker {
          color: #a855f7;
        }
        .editor-bullets-purple .ProseMirror ol li::marker {
          color: #a855f7;
          font-weight: 700;
        }

        .editor-bullets-blue .ProseMirror ul li::marker {
          color: #3b82f6;
        }
        .editor-bullets-blue .ProseMirror ol li::marker {
          color: #3b82f6;
          font-weight: 700;
        }

        .editor-bullets-cyan .ProseMirror ul li::marker {
          color: #06b6d4;
        }
        .editor-bullets-cyan .ProseMirror ol li::marker {
          color: #06b6d4;
          font-weight: 700;
        }

        .editor-bullets-green .ProseMirror ul li::marker {
          color: #10b981;
        }
        .editor-bullets-green .ProseMirror ol li::marker {
          color: #10b981;
          font-weight: 700;
        }

        .editor-bullets-amber .ProseMirror ul li::marker {
          color: #f59e0b;
        }
        .editor-bullets-amber .ProseMirror ol li::marker {
          color: #f59e0b;
          font-weight: 700;
        }

        .editor-bullets-orange .ProseMirror ul li::marker {
          color: #f97316;
        }
        .editor-bullets-orange .ProseMirror ol li::marker {
          color: #f97316;
          font-weight: 700;
        }

        .editor-bullets-pink .ProseMirror ul li::marker {
          color: #ec4899;
        }
        .editor-bullets-pink .ProseMirror ol li::marker {
          color: #ec4899;
          font-weight: 700;
        }

        /* Bold text with colors - ensure color is preserved */
        .ProseMirror strong[style*="color"] {
          font-weight: bold !important;
        }

        .ProseMirror strong {
          font-weight: 700;
          letter-spacing: -0.01em;
        }

        /* Ensure colored bold text is visible */
        .ProseMirror strong[style*="color"] {
          opacity: 1;
        }

        /* Quote marks - add back with CSS pseudo-elements */
        .quote-mark[data-quote-type="double"]::before {
          content: '"';
          pointer-events: none;
        }

        .quote-mark[data-quote-type="double"]::after {
          content: '"';
          pointer-events: none;
        }

        .quote-mark[data-quote-type="single"]::before {
          content: "'";
          pointer-events: none;
        }

        .quote-mark[data-quote-type="single"]::after {
          content: "'";
          pointer-events: none;
        }

        /* Inline Quote Styles - for quoted text */
        .quote-mark.quote-default {
          /* Keep default appearance */
        }

        .quote-mark.quote-italic {
          font-style: italic;
        }

        .quote-mark.quote-bold {
          font-weight: 600;
        }

        .quote-mark.quote-bold-italic {
          font-weight: 600;
          font-style: italic;
        }

        .quote-mark.quote-purple-italic {
          color: #a855f7;
          font-style: italic;
        }

        .quote-mark.quote-purple-bold {
          color: #a855f7;
          font-weight: 600;
        }

        .quote-mark.quote-cyan-bold {
          color: #06b6d4;
          font-weight: 600;
        }

        .quote-mark.quote-amber-italic {
          color: #f59e0b;
          font-style: italic;
        }

        .quote-mark.quote-green-italic {
          color: #10b981;
          font-style: italic;
        }

        .quote-mark.quote-pink-bold {
          color: #ec4899;
          font-weight: 600;
        }

        .quote-mark.quote-orange-bold {
          color: #fb923c;
          font-weight: 600;
        }

        /* Blockquote styles (for block quotes) */
        .ProseMirror blockquote {
          border-left: 3px solid #888888;
          padding-left: 1rem;
          margin: 1rem 0;
          color: #888888;
        }
      `}</style>
    </div>
  );
};
