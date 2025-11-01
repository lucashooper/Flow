import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { DOMParser as PMDOMParser } from 'prosemirror-model';
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
import { SpellCheck } from '../extensions/SpellCheck';
import 'prosemirror-view/style/prosemirror.css';
import { Bold, Italic, Code, Link as LinkIcon, Minus, Plus, Pencil } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { ContextMenu } from './ContextMenu';
import { PersistentDrawingLayer } from './PersistentDrawingLayer';
import { WordCount } from './WordCount';
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
  const isInternalUpdate = useRef(false);

  // Initialize spell checker on mount
  useEffect(() => {
    console.log('🔤 Initializing spell checker...');
    initSpellChecker().then(() => {
      console.log('✅ Spell checker ready!');
    }).catch((err) => {
      console.error('❌ Spell checker failed to load:', err);
    });
  }, []);
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
      SpellCheck,
    ],
    content,
    onUpdate: ({ editor }) => {
      const newContent = editor.getHTML();
      console.log('📝 Editor onUpdate triggered, content length:', newContent.length);
      isInternalUpdate.current = true;
      onChange(newContent);
      // Reset flag after a short delay to allow prop update
      setTimeout(() => {
        isInternalUpdate.current = false;
      }, 100);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-full',
        style: 'line-height: 1.7; color: #e5e5e5; max-width: 800px; margin: 0 auto; padding: 1.5rem 2rem; width: 100%;',
        spellcheck: 'true',
      },
      handlePaste: (view, event) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) {
          console.log('❌ No clipboard data available');
          return false;
        }

        console.log('📋 Paste event - Available formats:', Array.from(clipboardData.types));

        // Get both HTML and plain text
        const html = clipboardData.getData('text/html');
        const plainText = clipboardData.getData('text/plain');

        // Check if this is from Microsoft Office (has RTF or specific Office markers)
        const isFromOffice = clipboardData.types.includes('text/rtf') || 
                            (html && (html.includes('xmlns:o="urn:schemas-microsoft-com') || 
                                     html.includes('ProgId=') || 
                                     html.includes('MsoNormal')));

        if (isFromOffice) {
          console.log('🏢 Detected Microsoft Office paste - using plain text to avoid styling issues');
          
          // For Office apps, use plain text to avoid black text and huge fonts
          if (plainText) {
            console.log('✅ Pasting plain text from Office:', plainText.substring(0, 100));
            
            const { from } = view.state.selection;
            const tr = view.state.tr.insertText(plainText, from);
            view.dispatch(tr);
            console.log('✅ Plain text inserted at position:', from);
            
            setTimeout(() => {
              console.log('📄 Editor content:', editor?.getText().substring(0, 100));
            }, 50);
            
            return true;
          }
        }

        // Try HTML for web sources (Google Docs, etc.)
        if (html && !isFromOffice) {
          console.log('✅ Found HTML data (web source):', html.substring(0, 200));
          
          // Clean up Microsoft Office HTML artifacts and ALL styling
          let cleanHTML = html
            .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
            .replace(/<o:p>[\s\S]*?<\/o:p>/g, '') // Remove Office paragraph tags
            .replace(/<\/o:p>/g, '') // Remove closing Office tags
            .replace(/class="[^"]*"/g, '') // Remove ALL classes
            .replace(/style="[^"]*"/g, '') // Remove ALL inline styles (color, font-size, etc.)
            .replace(/color="[^"]*"/g, '') // Remove color attributes
            .replace(/bgcolor="[^"]*"/g, '') // Remove background colors
            .replace(/face="[^"]*"/g, '') // Remove font face
            .replace(/size="[^"]*"/g, '') // Remove font size
            .replace(/<font[^>]*>/g, '') // Remove font tags
            .replace(/<\/font>/g, '')
            .replace(/<span[^>]*>/g, '<span>') // Strip span attributes but keep tag
            .replace(/<div[^>]*>/g, '<div>') // Strip div attributes
            .replace(/<p[^>]*>/g, '<p>') // Strip paragraph attributes
            .replace(/<w:[\s\S]*?>/g, '') // Remove Word XML tags
            .replace(/<m:[\s\S]*?>/g, '') // Remove Math XML tags
            .replace(/<xml>[\s\S]*?<\/xml>/g, '') // Remove XML blocks
            .replace(/<\?xml[\s\S]*?\?>/g, '') // Remove XML declarations
            .replace(/<head>[\s\S]*?<\/head>/g, '') // Remove head tags
            .replace(/<html[^>]*>/gi, '') // Remove html tags
            .replace(/<\/html>/gi, '')
            .replace(/<body[^>]*>/gi, '') // Remove body tags
            .replace(/<\/body>/gi, '');

          console.log('🧹 Cleaned HTML:', cleanHTML.substring(0, 200));

          // Parse HTML and insert into editor
          try {
            const parser = new DOMParser();
            const htmlDoc = parser.parseFromString(cleanHTML, 'text/html');
            
            // Extract text content as fallback
            const textContent = htmlDoc.body.textContent || htmlDoc.body.innerText || '';
            console.log('📝 Extracted text from HTML:', textContent.substring(0, 100));

            // Try to parse as ProseMirror slice first
            const { state } = view;
            const pmParser = PMDOMParser.fromSchema(state.schema);
            
            try {
              const slice = pmParser.parseSlice(htmlDoc.body);
              
              // Check if slice has actual content
              if (slice && slice.size > 0) {
                const tr = state.tr.replaceSelection(slice);
                view.dispatch(tr);
                console.log('✅ HTML slice inserted successfully, size:', slice.size);
                
                // Verify content was inserted
                setTimeout(() => {
                  console.log('📄 Editor content length:', editor?.getText().length);
                }, 50);
                
                return true;
              } else {
                console.log('⚠️ Slice is empty, falling back to text extraction');
              }
            } catch (sliceError) {
              console.error('❌ Slice parsing failed:', sliceError);
            }

            // Fallback: Insert extracted text content
            if (textContent.trim()) {
              const { from } = state.selection;
              const tr = state.tr.insertText(textContent, from);
              view.dispatch(tr);
              console.log('✅ Text content inserted at position:', from);
              
              // Verify insertion
              setTimeout(() => {
                console.log('📄 Editor content after text insert:', editor?.getText().substring(0, 100));
              }, 50);
              
              return true;
            }

          } catch (error) {
            console.error('❌ HTML parsing failed:', error);
          }
        }

        // Fallback to plain text (always available)
        if (plainText) {
          console.log('✅ Using plain text fallback:', plainText.substring(0, 100));
          
          // Insert as plain text at cursor position
          const { from } = view.state.selection;
          const tr = view.state.tr.insertText(plainText, from);
          view.dispatch(tr);
          console.log('✅ Plain text inserted at position:', from);
          
          // Verify insertion
          setTimeout(() => {
            console.log('📄 Final editor content:', editor?.getText().substring(0, 100));
          }, 50);
          
          return true;
        }

        // Handle file paste (images from PowerPoint/Word)
        const files = Array.from(clipboardData.files);
        if (files.length > 0) {
          console.log('📎 Files detected:', files.map(f => f.type));
          
          files.forEach(file => {
            if (file.type.startsWith('image/')) {
              const reader = new FileReader();
              reader.onload = async (e) => {
                const dataUrl = e.target?.result as string;
                
                // Upload to Supabase if available, otherwise use data URL
                let imageUrl = dataUrl;
                if (uploadImage) {
                  const uploaded = await uploadImage(file);
                  if (uploaded) imageUrl = uploaded;
                }
                
                // Insert image
                view.dispatch(
                  view.state.tr.replaceSelectionWith(
                    view.state.schema.nodes.image.create({ src: imageUrl })
                  )
                );
                console.log('✅ Image pasted successfully');
              };
              reader.readAsDataURL(file);
            }
          });
          return true;
        }

        console.log('⚠️ No compatible paste format found');
        return false;
      },
    },
  });

  // Update editor content when prop changes (for switching notes)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      // Don't reset content if the change came from the editor itself (e.g., paste)
      if (isInternalUpdate.current) {
        console.log('⏭️ Skipping setContent - internal update');
        return;
      }
      console.log('🔄 Setting editor content from prop');
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

    // Check if we clicked on a misspelled word (already marked by SpellCheck extension)
    let clickedElement = target as HTMLElement;
    
    // Check if target itself or any parent has the misspelled-word class
    if (!clickedElement.classList.contains('misspelled-word')) {
      clickedElement = target.closest('.misspelled-word') as HTMLElement;
    }
    
    let misspelledWord: string | undefined;
    let suggestions: string[] = [];

    if (clickedElement && clickedElement.classList.contains('misspelled-word')) {
      // Try to get word from data attribute first
      misspelledWord = clickedElement.getAttribute('data-word') || undefined;
      
      // If no data attribute, get the text content
      if (!misspelledWord && clickedElement.textContent) {
        misspelledWord = clickedElement.textContent.trim();
      }
      
      console.log('🔍 Clicked misspelled word:', misspelledWord);
      
      // Get suggestions immediately (cached, so fast)
      if (misspelledWord) {
        suggestions = getSpellingSuggestions(misspelledWord);
        console.log('💡 Suggestions:', suggestions);
      }
    } else if (!selectedText || selectedText.length === 0) {
      // If no selection and not on misspelled word, check word at cursor
      const pos = editor.state.selection.from;
      const $pos = editor.state.doc.resolve(pos);
      const textNode = $pos.parent.textContent;
      const offset = $pos.parentOffset;
      
      // Find word boundaries
      let start = offset;
      let end = offset;
      
      while (start > 0 && /\w/.test(textNode[start - 1])) start--;
      while (end < textNode.length && /\w/.test(textNode[end])) end++;
      
      const wordAtCursor = textNode.substring(start, end);
      
      if (wordAtCursor && wordAtCursor.length > 2) {
        const isCorrect = isWordCorrect(wordAtCursor);
        if (!isCorrect) {
          misspelledWord = wordAtCursor;
          suggestions = getSpellingSuggestions(wordAtCursor);
        }
      }
    }

    // Show menu immediately with all data
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      text: selectedText,
      misspelledWord,
      suggestions,
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

      {/* Word Count */}
      <WordCount editor={editor} />

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

        /* Misspelled words - red wavy underline */
        .ProseMirror .misspelled-word {
          text-decoration: underline wavy #ef4444;
          text-decoration-thickness: 1.5px;
          text-underline-offset: 2px;
          cursor: pointer;
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
