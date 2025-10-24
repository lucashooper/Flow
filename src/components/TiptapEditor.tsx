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
import { ResizableImage } from '../extensions/ResizableImage';
import { FontSize } from '../extensions/FontSize';
import { ImagePaste } from '../extensions/ImagePaste';
import 'prosemirror-view/style/prosemirror.css';
import { Bold, Italic, Code, Link as LinkIcon, Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ContextMenu } from './ContextMenu';
import { supabase } from '../lib/supabase';

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

export const TiptapEditor = ({ content, onChange, placeholder }: TiptapEditorProps) => {
  const [showBubbleMenu, setShowBubbleMenu] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; text: string } | null>(null);

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
        link: false, // Disable built-in link to avoid duplicates
      }),
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
        class: 'prose prose-invert max-w-none focus:outline-none px-8 py-6 min-h-full',
        style: 'line-height: 1.7; color: #e5e5e5;',
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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!editor) return;

    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, ' ');

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      text,
    });
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

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] relative" onContextMenu={handleContextMenu}>
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
            onClick={() => editor.chain().focus().toggleBold().run()}
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
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          editor={editor}
          x={contextMenu.x}
          y={contextMenu.y}
          selectedText={contextMenu.text}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <EditorContent editor={editor} />
      </div>

      <style>{`
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

        /* Premium Bullet Styles */
        .ProseMirror ul {
          list-style: none;
          padding-left: 1.5em;
        }

        .ProseMirror ul li {
          position: relative;
        }

        .ProseMirror ul li::before {
          content: '•';
          position: absolute;
          left: -1.2em;
          color: #888888;
          font-size: 1.1em;
          font-weight: bold;
          transition: color 150ms ease;
        }

        /* Custom bullet colors */
        .ProseMirror ul[data-bullet-color="purple"] li::before {
          color: #a855f7;
        }

        .ProseMirror ul[data-bullet-color="blue"] li::before {
          color: #06b6d4;
        }

        .ProseMirror ul[data-bullet-color="amber"] li::before {
          color: #f59e0b;
        }

        .ProseMirror ul[data-bullet-color="green"] li::before {
          color: #10b981;
        }

        .ProseMirror ul[data-bullet-color="pink"] li::before {
          color: #ec4899;
        }

        .ProseMirror ul[data-bullet-color="gray"] li::before {
          color: #888888;
        }
      `}</style>
    </div>
  );
};
