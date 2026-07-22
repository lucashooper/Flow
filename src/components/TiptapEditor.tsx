import { useEditor, EditorContent, type Editor } from '@tiptap/react';
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
import { ResizableVideo } from '../extensions/ResizableVideo.tsx';
import { FontSize } from '../extensions/FontSize';
import { ImagePaste } from '../extensions/ImagePaste';
import { ColoredBold } from '../extensions/ColoredBold';
// import { QuoteMark } from '../extensions/QuoteMark'; // Disabled - causing glitching bug
import { DrawingNode } from '../extensions/DrawingNode';
import { EmojiIconDecorator } from '../extensions/EmojiIconDecorator';
// import { SpellCheck } from '../extensions/SpellCheck'; // Disabled - using browser native
import 'prosemirror-view/style/prosemirror.css';
import { Bold, Italic, Code, Link as LinkIcon, Minus, Plus, Pencil, List, MoreVertical, Quote } from 'lucide-react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { applyFormattingAction, STARRED_FORMATTING_KEY } from '../utils/applyFormattingAction';
import type { StarredFormattingAction } from '../utils/applyFormattingAction';
import { ContextMenu } from './ContextMenu';
import { PersistentDrawingLayer } from './PersistentDrawingLayer';
import { WordCount } from './WordCount';
import { supabase } from '../lib/supabase';
import { AutoItalicQuotes } from '../extensions/AutoItalicQuotes';
import { Mathematics } from '@tiptap/extension-mathematics';
import 'katex/dist/katex.min.css';
import {
  insertTextWithLatex,
  migrateAllMathInEditor,
  textContainsLatex,
} from '../utils/parseLatexText';
import {
  htmlHasStructure,
  isInternalFlowPaste,
  plainTextToDocBlocks,
  sanitizePastedHtml,
} from '../utils/sanitizePastedHtml';
// import { isWordCorrect, getSpellingSuggestionsAsync, initSpellChecker } from '../utils/spellcheck'; // Not needed - using browser native

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  drawingData?: string;
  onDrawingChange?: (data: string) => void;
  placeholder?: string;
  searchQuery?: string;
  noteTitle?: string;
}

export const TiptapEditor = ({ content, onChange, drawingData: initialDrawingData, onDrawingChange, placeholder, searchQuery, noteTitle }: TiptapEditorProps) => {
  const [showBubbleMenu, setShowBubbleMenu] = useState(false);
  const [bubbleMenuPosition, setBubbleMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; text: string; misspelledWord?: string; suggestions?: string[] } | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const isInternalUpdate = useRef(false);
  const tiptapEditorRef = useRef<Editor | null>(null);
  const showMenuTimeout = useRef<number | null>(null);
  const lastSelectionTime = useRef<number>(0);

  // Spell checker initialization removed - using browser native spell check
  // useEffect(() => {
  //   console.log('🔤 Initializing spell checker...');
  //   initSpellChecker().then(() => {
  //     console.log('✅ Spell checker ready!');
  //   }).catch((err) => {
  //     console.error('❌ Spell checker failed to load:', err);
  //   });
  
  // Default auto-italicize quotes to ON if not set
  useEffect(() => {
    const raw = localStorage.getItem('autoItalicQuotesEnabled');
    if (raw === null) {
      localStorage.setItem('autoItalicQuotesEnabled', 'true');
      setAutoItalicEnabled(true);
    } else {
      setAutoItalicEnabled(raw === 'true');
    }
  }, []);
  // }, []);
  const [bulletStyle, setBulletStyle] = useState<string>(() => {
    return localStorage.getItem('bulletStyle') || 'gray';
  });
  const [autoItalicEnabled, setAutoItalicEnabled] = useState<boolean>(() => {
    return localStorage.getItem('autoItalicQuotesEnabled') === 'true';
  });
  // Deduplicate starred actions by (type, value) pair
  const dedupeStarred = (list: StarredFormattingAction[]): StarredFormattingAction[] => {
    const seen = new Set<string>();
    const result: StarredFormattingAction[] = [];

    for (const item of list) {
      const key = `${item.type}:${item.value}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }
    return result;
  };

  const [starredFormatting, setStarredFormatting] = useState<StarredFormattingAction[]>(() => {
    try {
      const raw = localStorage.getItem(STARRED_FORMATTING_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const deduped = dedupeStarred(parsed);
      console.log('[⭐] Loaded starredActions', deduped);
      return deduped;
    } catch {
      return [];
    }
  });
  // const [quoteStyle, setQuoteStyle] = useState<string>(() => {
  //   return localStorage.getItem('quoteStyle') || 'default';
  // }); // Disabled - QuoteMark extension removed

  // Define stable order for starred action types
  const STARRED_TYPE_ORDER = [
    'fontSize',
    'textColor',
    'highlight',
    'boldColor',
    'bulletStyle',
  ];

  // Sort starred actions by type for organized toolbar display
  const sortStarredActions = (actions: StarredFormattingAction[]): StarredFormattingAction[] => {
    return [...actions].sort((a, b) => {
      const ia = STARRED_TYPE_ORDER.indexOf(a.type);
      const ib = STARRED_TYPE_ORDER.indexOf(b.type);

      const aIndex = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
      const bIndex = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;

      if (aIndex !== bIndex) return aIndex - bIndex;

      // Same type → keep original order (stable)
      return 0;
    });
  };

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
      AutoItalicQuotes,
      // QuoteMark, // ❌ DISABLED - causing glitching bug when pressing Enter inside quotes
      // SpellCheck, // ❌ DISABLED - causing 6+ second delays, using browser native instead
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
        inline: true,
        allowBase64: true,
      }),
      ResizableVideo,
      ImagePaste.configure({
        uploadImage,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-[#D97706] underline cursor-pointer',
        },
      }),
      EmojiIconDecorator,
      Mathematics.configure({
        katexOptions: {
          throwOnError: false,
        },
      }),
      // SpellCheck, // Disabled - using browser native spell check
    ],
    content,
    onCreate: ({ editor: createdEditor }) => {
      tiptapEditorRef.current = createdEditor;
      if (textContainsLatex(createdEditor.getText())) {
        migrateAllMathInEditor(createdEditor);
      }
    },
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
        style: 'line-height: 1.7; color: #e0e0e0; max-width: 800px; margin: 0 auto; padding: 1.5rem 2rem; width: 100%;',
        spellcheck: 'true',
      },
      handlePaste: (view, event) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) {
          console.log('❌ No clipboard data available');
          return false;
        }

        console.log('📋 Paste event - Available formats:', Array.from(clipboardData.types));

        const html = clipboardData.getData('text/html');
        const plainText = clipboardData.getData('text/plain');
        const hasStructuredHtml = Boolean(html && htmlHasStructure(html));

        const insertSanitizedHtml = (rawHtml: string, preserveColors: boolean): boolean => {
          const processedHTML = sanitizePastedHtml(rawHtml, { preserveColors });
          try {
            const parser = new DOMParser();
            const htmlDoc = parser.parseFromString(processedHTML, 'text/html');
            const { state } = view;
            const pmParser = PMDOMParser.fromSchema(state.schema);
            const slice = pmParser.parseSlice(htmlDoc.body);

            if (slice?.size > 0) {
              event.preventDefault();
              view.dispatch(state.tr.replaceSelection(slice));
              setTimeout(() => {
                const ed = tiptapEditorRef.current;
                if (ed) migrateAllMathInEditor(ed);
              }, 0);
              return true;
            }
          } catch (error) {
            console.error('❌ Failed to parse pasted HTML:', error);
          }
          return false;
        };
        
        // ✅ CRITICAL: Check for files/images ONLY if there's no text content
        // This fixes Snipping Tool paste while preserving PowerPoint text paste
        const files = Array.from(clipboardData.files);
        const hasTextContent = plainText.trim().length > 0 || html.trim().length > 0;
        
        if (files.length > 0 && !hasTextContent) {
          console.log('📎 Files detected (no text):', files.map(f => `${f.name} (${f.type})`));
          
          const imageFiles = files.filter(file => file.type.startsWith('image/'));
          const videoFiles = files.filter(file => file.type.startsWith('video/'));
          
          if (imageFiles.length > 0) {
            console.log('🖼️ Processing', imageFiles.length, 'image(s) from clipboard');
            event.preventDefault(); // Block default handling
            
            imageFiles.forEach(file => {
              console.log('📸 Reading image:', file.name || 'clipboard-image', file.type);
              
              const reader = new FileReader();
              reader.onload = async (e) => {
                const dataUrl = e.target?.result as string;
                console.log('✅ Image loaded, size:', Math.round(dataUrl.length / 1024), 'KB');
                
                // Upload to Supabase if available, otherwise use data URL
                let imageUrl = dataUrl;
                if (uploadImage) {
                  console.log('☁️ Uploading to Supabase...');
                  const uploaded = await uploadImage(file);
                  if (uploaded) {
                    imageUrl = uploaded;
                    console.log('✅ Uploaded to Supabase:', imageUrl);
                  }
                }
                
                // Insert image into editor (use resizableImage node name)
                const imageNode = view.state.schema.nodes.resizableImage || view.state.schema.nodes.image;
                if (imageNode) {
                  view.dispatch(
                    view.state.tr.replaceSelectionWith(
                      imageNode.create({ src: imageUrl })
                    )
                  );
                  console.log('✅ Image inserted into editor');
                } else {
                  console.error('❌ Image node not found in schema');
                }
              };
              
              reader.onerror = (error) => {
                console.error('❌ Image read failed:', error);
              };
              
              reader.readAsDataURL(file);
            });
            
            return true; // We handled it
          }
          
          if (videoFiles.length > 0) {
            console.log('🎥 Processing', videoFiles.length, 'video(s) from clipboard');
            event.preventDefault(); // Block default handling
            
            videoFiles.forEach(file => {
              console.log('🎬 Reading video:', file.name || 'clipboard-video', file.type);
              
              const reader = new FileReader();
              reader.onload = async (e) => {
                const dataUrl = e.target?.result as string;
                console.log('✅ Video loaded, size:', Math.round(dataUrl.length / 1024), 'KB');
                
                // Upload to Supabase if available, otherwise use data URL
                let videoUrl = dataUrl;
                if (uploadImage) {
                  console.log('☁️ Uploading video to Supabase...');
                  const uploaded = await uploadImage(file);
                  if (uploaded) {
                    videoUrl = uploaded;
                    console.log('✅ Video uploaded to Supabase:', videoUrl);
                  }
                }
                
                // Insert video into editor
                const videoNode = view.state.schema.nodes.resizableVideo;
                if (videoNode) {
                  view.dispatch(
                    view.state.tr.replaceSelectionWith(
                      videoNode.create({ src: videoUrl })
                    )
                  );
                  console.log('✅ Video inserted into editor');
                } else {
                  console.error('❌ Video node not found in schema');
                }
              };
              
              reader.onerror = (error) => {
                console.error('❌ Video read failed:', error);
              };
              
              reader.readAsDataURL(file);
            });
            
            return true; // We handled it
          }
        }

        // Check if this is from Microsoft Office (has RTF or specific Office markers)
        const isFromOffice = clipboardData.types.includes('text/rtf') || 
                            (html && (html.includes('xmlns:o="urn:schemas-microsoft-com') || 
                                     html.includes('ProgId=') || 
                                     html.includes('MsoNormal')));

        if (isFromOffice && html) {
          console.log('🏢 Detected Microsoft Office paste - preserving structure');
          if (insertSanitizedHtml(html, false)) {
            return true;
          }
        }

        // Prefer structured HTML (Gemini, ChatGPT, Google Docs) over plain-text LaTeX
        if (html && !isFromOffice) {
          console.log('✅ Found HTML data:', html.substring(0, 200));

          if (html.includes('<img')) {
            console.log('🖼️ HTML contains <img> tag - delegating to ImagePaste extension');
            return false;
          }

          if (hasStructuredHtml) {
            const internal = isInternalFlowPaste(html);
            console.log(internal ? '🔄 Internal Flow paste' : '🌐 External paste — preserving structure, stripping color/font');
            if (insertSanitizedHtml(html, internal)) {
              return true;
            }
          }
        }

        // Plain-text LaTeX when HTML has no usable structure (Gemini math-only snippets)
        if (plainText && textContainsLatex(plainText) && !hasStructuredHtml) {
          const ed = tiptapEditorRef.current;
          if (ed && !ed.isDestroyed) {
            event.preventDefault();
            console.log('🔢 LaTeX paste detected — rendering math');
            if (insertTextWithLatex(view, ed, plainText)) {
              return true;
            }
          }
        }

        // Unstructured HTML fallback (single paragraph wrappers)
        if (html && !isFromOffice && !hasStructuredHtml) {
          if (insertSanitizedHtml(html, isInternalFlowPaste(html))) {
            return true;
          }
        }

        // Fallback to plain text with paragraph / heading structure preserved
        if (plainText) {
          console.log('✅ Using plain text fallback:', plainText.substring(0, 100));
          event.preventDefault();

          const ed = tiptapEditorRef.current;
          if (ed && textContainsLatex(plainText)) {
            if (insertTextWithLatex(view, ed, plainText)) {
              return true;
            }
          }

          if (ed && !ed.isDestroyed) {
            const blocks = plainTextToDocBlocks(plainText);
            if (ed.commands.insertContent(blocks)) {
              setTimeout(() => migrateAllMathInEditor(ed), 0);
              return true;
            }
          }

          const { from } = view.state.selection;
          view.dispatch(view.state.tr.insertText(plainText, from));
          return true;
        }

        // No compatible paste format found
        console.log('⚠️ No compatible paste format found');
        return false;
      },
    },
  });

  useEffect(() => {
    if (editor) tiptapEditorRef.current = editor;
  }, [editor]);

  // Track last content prop to prevent unnecessary updates
  const lastContentProp = useRef<string>('');

  // Update editor content when prop changes (for switching notes)
  useEffect(() => {
    if (!editor) return;
    
    // Only update if content prop actually changed
    if (content !== lastContentProp.current) {
      lastContentProp.current = content;
      
      // Don't reset content if the change came from the editor itself (e.g., paste)
      if (isInternalUpdate.current) {
        console.log('⏭️ Skipping setContent - internal update');
        isInternalUpdate.current = false;
        return;
      }
      
      // Only update if editor content is different from prop
      if (content !== editor.getHTML()) {
        console.log('🔄 Setting editor content from prop (note switch)');
        // Use emitUpdate:false so this doesn't trigger onChange → auto-save loop
        editor.commands.setContent(content, { emitUpdate: false });
        if (textContainsLatex(content)) {
          setTimeout(() => migrateAllMathInEditor(editor), 0);
        }
        
        // CRITICAL: Clear undo history after switching notes.
        // Without this, Ctrl+Z undoes back to the previous note's content,
        // which can delete/replace the current note's text.
        // This matches Notion/Obsidian behavior — each note has fresh undo history.
        //
        // Find the ProseMirror history plugin and reset its state to a fresh
        // empty HistoryState by dispatching a transaction with the plugin key's
        // meta set to { historyState: <freshState> }.
        // See prosemirror-history/src/history.ts applyTransaction():
        //   let historyTr = tr.getMeta(historyKey);
        //   if (historyTr) return historyTr.historyState;
        const historyPlugin = editor.state.plugins.find(
          (plugin: any) => plugin.key === 'history$'
        );
        if (historyPlugin) {
          // Get a fresh empty HistoryState from the plugin's init()
          const freshState = (historyPlugin as any).spec.state.init();
          const tr = editor.state.tr;
          tr.setMeta(historyPlugin, { historyState: freshState });
          tr.setMeta('addToHistory', false);
          editor.view.dispatch(tr);
          console.log('🧹 Cleared undo history for fresh note');
        }
      }
    }
  }, [content, editor]);

  // Track drag state for visual feedback
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // Prevent browser's default drag-and-drop behavior (opening files in new tab)
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      // Always prevent default to allow drop
      e.preventDefault();
      console.log('🎯 [TiptapEditor] dragover on:', e.target);
    };

    const handleDragEnter = (e: DragEvent) => {
      console.log('🎯 [TiptapEditor] dragenter on:', e.target, 'types:', e.dataTransfer?.types);
      // Check if dragging files (not text)
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDraggingFile(true);
        document.body.classList.add('dragging-file');
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      console.log('🎯 [TiptapEditor] dragleave from:', e.target);
      // Only hide overlay if leaving the document entirely
      if (e.target === document.body || e.relatedTarget === null) {
        setIsDraggingFile(false);
        document.body.classList.remove('dragging-file');
      }
    };

    const handleDrop = (e: DragEvent) => {
      console.log('🎯 [TiptapEditor] drop on:', e.target, 'files:', e.dataTransfer?.files.length);
      setIsDraggingFile(false);
      document.body.classList.remove('dragging-file');
      
      // Check if this is a media file drop
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const mediaFiles = Array.from(files).filter(f => 
          f.type.startsWith('image/') || f.type.startsWith('video/')
        );
        
        if (mediaFiles.length > 0 && editor) {
          console.log('🎯 [TiptapEditor] Media files detected, handling drop');
          e.preventDefault();
          e.stopPropagation();
          
          // Insert at end of document
          const endPos = editor.state.doc.content.size;
          editor.chain().focus().setTextSelection(endPos).run();
          
          // Process each media file
          mediaFiles.forEach(file => {
            console.log('📸 [TiptapEditor] Processing file:', file.name, file.type);
            
            // Create temporary base64 preview
            const reader = new FileReader();
            reader.onload = async (event) => {
              const base64 = event.target?.result as string;
              const isVideo = file.type.startsWith('video/');
              const nodeType = isVideo ? 'resizableVideo' : 'resizableImage';
              
              // Insert temporary media
              editor.chain().focus().insertContent({
                type: nodeType,
                attrs: {
                  src: base64,
                  'data-uploading': true,
                },
              }).run();
              
              // Upload to Supabase
              try {
                const uploadedUrl = await uploadImage(file);
                if (uploadedUrl) {
                  // Replace temporary media with uploaded URL
                  const { state } = editor;
                  const { doc } = state;
                  let found = false;
                  
                  doc.descendants((node, pos) => {
                    if ((node.type.name === 'resizableImage' || node.type.name === 'resizableVideo') && 
                        node.attrs.src === base64) {
                      const tr = state.tr.setNodeMarkup(pos, undefined, {
                        ...node.attrs,
                        src: uploadedUrl,
                        'data-uploading': false,
                      });
                      editor.view.dispatch(tr);
                      found = true;
                      console.log('✅ [TiptapEditor] Replaced temp media with uploaded URL');
                      return false;
                    }
                  });
                  
                  if (!found) {
                    console.warn('⚠️ [TiptapEditor] Could not find temp media to replace');
                  }
                } else {
                  console.error('❌ [TiptapEditor] Upload failed');
                }
              } catch (error) {
                console.error('❌ [TiptapEditor] Upload error:', error);
              }
            };
            reader.readAsDataURL(file);
          });
          
          return;
        }
      }
      
      console.log('✅ [TiptapEditor] No media files, allowing default behavior');
    };

    // Prevent browser from opening dropped files in a new tab
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);

  // Store search query in a ref to use in editor update callback
  const searchQueryRef = useRef(searchQuery);
  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  // Perform search when editor content updates
  const performSearch = useCallback((editorInstance: any) => {
    const query = searchQueryRef.current;
    
    if (!query) {
      console.log('ℹ️ [TiptapEditor] No search query');
      return;
    }
    
    console.log('✅ [TiptapEditor] Performing search for:', query);
    
    const { state } = editorInstance;
    const { doc } = state;
    const searchLower = query.toLowerCase();
    
    let firstMatchPos: number | null = null;
    let matchCount = 0;
    
    doc.descendants((node: any, pos: number) => {
      if (node.isText && node.text) {
        const text = node.text.toLowerCase();
        const index = text.indexOf(searchLower);
        if (index !== -1) {
          matchCount++;
          if (firstMatchPos === null) {
            firstMatchPos = pos + index;
            console.log('🎯 [TiptapEditor] First match found at position:', firstMatchPos, 'in text:', node.text.substring(index, index + 20));
          }
        }
      }
    });
    
    console.log(`📊 [TiptapEditor] Found ${matchCount} match(es) for "${query}"`);
    
    if (firstMatchPos !== null) {
      const matchPos = firstMatchPos;
      console.log('🎯 [TiptapEditor] Highlighting match at position:', matchPos);
      
      setTimeout(() => {
        // Select the text
        editorInstance.commands.setTextSelection({
          from: matchPos,
          to: matchPos + query.length
        });
        
        // Apply orange highlight with good contrast against white text
        editorInstance.commands.setMark('highlight', { color: '#fb923c' });
        
        // Scroll to the match - use the ProseMirror position to find the DOM node
        const editorElement = editorInstance.view.dom;
        const { from } = editorInstance.state.selection;
        const domNode = editorInstance.view.domAtPos(from);
        
        if (domNode && domNode.node) {
          // Find the closest element we can scroll to
          let targetElement = domNode.node.nodeType === Node.TEXT_NODE 
            ? domNode.node.parentElement 
            : domNode.node as HTMLElement;
          
          if (targetElement) {
            // Find the scroll container
            const scrollContainer = editorElement.closest('.custom-scrollbar') as HTMLElement;
            
            if (scrollContainer) {
              const targetRect = targetElement.getBoundingClientRect();
              const containerRect = scrollContainer.getBoundingClientRect();
              
              // Calculate scroll position to center the match
              const scrollTop = targetRect.top - containerRect.top + scrollContainer.scrollTop - 150;
              
              console.log('📜 [TiptapEditor] Scrolling to:', { 
                targetTop: targetRect.top, 
                containerTop: containerRect.top,
                scrollTop,
                currentScroll: scrollContainer.scrollTop
              });
              
              scrollContainer.scrollTop = scrollTop;
            }
          }
        }
        
        console.log('✨ [TiptapEditor] Highlight and scroll applied');
      }, 100);
    } else {
      console.log('❌ [TiptapEditor] No matches found in document');
    }
  }, []);

  // Trigger search when content loads
  useEffect(() => {
    if (editor && searchQuery && content) {
      console.log('🔍 [TiptapEditor] Content loaded, triggering search');
      const timeout = setTimeout(() => performSearch(editor), 300);
      return () => clearTimeout(timeout);
    }
  }, [editor, searchQuery, content, performSearch]);

  // Add keyboard shortcuts
  useEffect(() => {
    if (editor) {
      const handleKeyDown = (e: KeyboardEvent) => {
        // Cmd/Ctrl+ArrowUp: Jump to title
        if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowUp') {
          e.preventDefault();
          const titleInput = document.querySelector('input[placeholder="Untitled"]') as HTMLInputElement;
          if (titleInput) {
            titleInput.focus();
            titleInput.select();
          }
        }

        // Cmd/Ctrl+Shift+L: Convert to bullet list
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'L') {
          e.preventDefault();
          convertLinesToBulletList();
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

  // Listen for starred formatting actions changes
  useEffect(() => {
    const handleStarredFormattingActionsChange = (e: CustomEvent) => {
      const actions = Array.isArray(e.detail) ? e.detail : [];
      setStarredFormatting(dedupeStarred(actions));
    };

    window.addEventListener('starredFormattingActionsChanged', handleStarredFormattingActionsChange as EventListener);
    return () => window.removeEventListener('starredFormattingActionsChanged', handleStarredFormattingActionsChange as EventListener);
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

  const convertLinesToBulletList = () => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, '\n');

    if (!selectedText || !selectedText.trim()) {
      console.log('⚠️ No text selected');
      return;
    }

    // Split by line breaks and filter out empty lines
    const lines = selectedText.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      console.log('⚠️ No valid lines to convert');
      return;
    }

    console.log('📝 Converting lines to bullet list:', lines);

    // Delete selected text and insert bullet list
    editor
      .chain()
      .focus()
      .deleteRange({ from, to })
      .insertContent({
        type: 'bulletList',
        content: lines.map(line => ({
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: line.trim(),
            }],
          }],
        })),
      })
      .run();

    console.log('✅ Converted to bullet list');
  };

  useEffect(() => {
    if (editor) {
      const calculateMenuPosition = () => {
        const { from } = editor.state.selection;
        const { view } = editor;
        const start = view.coordsAtPos(from);
        
        // Bubble menu dimensions
        const menuHeight = 48;
        const menuOffset = 12;
        
        // Always position above the selection start (like Notion)
        let top = start.top - menuHeight - menuOffset;
        
        // Ensure menu stays on screen - if too close to top, add minimum offset
        const minTopOffset = 60; // Account for header/toolbar
        if (top < minTopOffset) {
          top = minTopOffset;
        }
        
        // CONSISTENT horizontal position: center of viewport
        const viewportWidth = window.innerWidth;
        const left = viewportWidth / 2;
        
        return { top, left };
      };

      const handleSelectionUpdate = () => {
        const { from, to } = editor.state.selection;
        const hasSelection = from !== to;
        
        // Clear any pending timeout
        if (showMenuTimeout.current) {
          clearTimeout(showMenuTimeout.current);
          showMenuTimeout.current = null;
        }
        
        if (!hasSelection) {
          setShowBubbleMenu(false);
          setBubbleMenuPosition(null);
          return;
        }
        
        // DEBOUNCE: Wait 300ms after selection stops changing
        showMenuTimeout.current = window.setTimeout(() => {
          const { from: currentFrom, to: currentTo } = editor.state.selection;
          if (currentFrom !== currentTo) {
            setBubbleMenuPosition(calculateMenuPosition());
            setShowBubbleMenu(true);
          }
        }, 300);
      };

      const handleMouseDown = (e: MouseEvent) => {
        // Only track if clicking in editor
        const target = e.target as HTMLElement;
        if (target.closest('.ProseMirror')) {
          setShowBubbleMenu(false);
          lastSelectionTime.current = Date.now();
        }
      };

      const handleMouseUp = () => {
        // Update timestamp on mouseup
        lastSelectionTime.current = Date.now();
      };

      editor.on('selectionUpdate', handleSelectionUpdate);
      document.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        editor.off('selectionUpdate', handleSelectionUpdate);
        document.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mouseup', handleMouseUp);
        if (showMenuTimeout.current) {
          clearTimeout(showMenuTimeout.current);
        }
      };
    }
  }, [editor]);

  // handleContextMenu removed - using browser native context menu for spell check
  // const handleContextMenu = async (e: React.MouseEvent) => {
  //   // Browser handles spell check natively
  // };

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

  useEffect(() => {
    const handler = () => setIsDrawingMode(prev => !prev);
    window.addEventListener('toggleDrawingMode', handler as EventListener);
    return () => window.removeEventListener('toggleDrawingMode', handler as EventListener);
  }, []);

  return (
    <div ref={editorRef} className={`h-full flex flex-col editor-root relative editor-bullets-${bulletStyle}`}>
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

      {/* Bubble Menu - appears on text selection */}
      {editor && showBubbleMenu && bubbleMenuPosition && (
        <div className="fixed z-50 flex items-center gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl p-1 animate-fadeIn"
          style={{
            top: `${bubbleMenuPosition.top}px`,
            left: `${bubbleMenuPosition.left}px`,
            transform: 'translateX(-50%)',
            pointerEvents: 'auto',
            animation: 'fadeIn 0.2s ease-out',
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

          {/* Auto-italicize quotes toggle */}
          <button
            onClick={() => {
              const next = !autoItalicEnabled;
              setAutoItalicEnabled(next);
              localStorage.setItem('autoItalicQuotesEnabled', String(next));
            }}
            className={`p-2 rounded transition-colors ${
              autoItalicEnabled ? 'bg-[#A0522D] text-white' : 'text-[#e5e5e5] hover:bg-[#252525]'
            }`}
            title="Auto-italicize quotes"
          >
            <Quote className="w-4 h-4" />
          </button>

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
            onClick={convertLinesToBulletList}
            className="p-2 rounded transition-colors text-[#a78bfa] hover:bg-[#252525] hover:text-[#c4b5fd]"
            title="Convert to Bullet List (Cmd/Ctrl+Shift+L)"
          >
            <List className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-[#2a2a2a] mx-1" />

          {/* Starred formatting actions row */}
          {starredFormatting.length > 0 && (() => {
            const sortedStarred = sortStarredActions(starredFormatting);
            return (
              <div className="flex items-center gap-2 pl-2 ml-2 border-l border-neutral-700">
                {sortedStarred.map((action, index) => {
                  const prev = sortedStarred[index - 1];
                  const isNewGroup = index > 0 && prev.type !== action.type;

                  return (
                    <button
                      key={action.type + ':' + action.value}
                      onClick={() => applyFormattingAction(editor, action)}
                      className={`px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-sm flex items-center gap-1 ${
                        isNewGroup ? 'ml-3' : ''
                      }`}
                      title={`Apply ${action.type}: ${action.value}`}
                    >
                      {action.type === 'textColor' && (
                        <span
                          className="w-3 h-3 rounded-full border border-[#2a2a2a]"
                          style={{ backgroundColor: action.value || '#e5e5e5' }}
                        />
                      )}
                      {action.type === 'highlight' && (
                        <span
                          className="w-4 h-2 rounded border border-[#2a2a2a]"
                          style={{ backgroundColor: action.value }}
                        />
                      )}
                      {action.type === 'boldColor' && (
                        <span
                          className="text-[10px] font-bold"
                          style={{ color: action.value || '#e5e5e5' }}
                        >
                          B
                        </span>
                      )}
                      {action.type === 'bulletStyle' && (
                        <span className="w-3 h-3 flex items-center justify-center">
                          <span className="w-2 h-2 rounded-full bg-[#e5e5e5]" />
                        </span>
                      )}
                      {action.type === 'fontSize' && (
                        <span className="text-[10px] text-[#e5e5e5]">
                          {action.value.replace('rem', '')}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })()}

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

          <div className="w-px h-6 bg-[#2a2a2a] mx-1" />

          {/* More Options - Opens custom context menu */}
          <button
            onClick={(e) => {
              const { from, to } = editor.state.selection;
              const selectedText = editor.state.doc.textBetween(from, to, ' ');
              
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                text: selectedText,
                misspelledWord: undefined,
                suggestions: [],
              });
            }}
            className="p-2 rounded transition-colors text-[#a78bfa] hover:bg-[#252525] hover:text-[#c4b5fd]"
            title="More Options (Font Size, Colors, Highlight, etc.)"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Context Menu - Opened via More Options button in bubble menu */}
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
      <WordCount editor={editor} noteTitle={noteTitle} />

      {/* Editor */}
      <EditorContent 
        editor={editor} 
        className="min-h-full prose prose-invert max-w-none editor-scrollbar"
        style={{ 
          maxWidth: '800px', 
          margin: '0 auto',
          padding: '2rem',
          paddingBottom: '50vh', // Large bottom padding for breathing room
          width: '100%'
        }}
      />

      <style>{`
        /* Smooth fade-in animation for bubble menu */
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
        
        /* Hide scrollbar on editor content itself */
        .editor-scrollbar::-webkit-scrollbar {
          width: 0px;
          background: transparent;
        }
        .editor-scrollbar {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE/Edge */
        }
        
        /* Inline images — hug content so multiple can sit on one row */
        .ProseMirror .resizable-image-wrapper {
          display: inline-block !important;
          vertical-align: top;
          width: auto !important;
          max-width: 100%;
          margin: 0.25rem 0.5rem 0.25rem 0;
          line-height: 0;
        }
        .ProseMirror .resizable-image-wrapper.ProseMirror-selectednode {
          outline: 2px solid #8cf !important;
          border-radius: 8px;
          outline-offset: 2px;
        }
        .ProseMirror .resizable-image-wrapper img {
          display: block;
          max-width: 100%;
          height: auto;
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

        /* Emoji characters should always render with native color, never inherit text styling */
        .ProseMirror .emoji-icon,
        .ProseMirror .emoji-icon span,
        .ProseMirror .emoji-icon span[style] {
          color: initial !important;
          -webkit-text-fill-color: initial !important;
          background: none !important;
          -webkit-background-clip: initial !important;
          background-clip: initial !important;
          font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif !important;
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
          color: #c4b5fd;
        }
        .editor-bullets-purple .ProseMirror ol li::marker {
          color: #c4b5fd;
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

        /* Disable pointer events on images/videos during file drag to prevent browser from thinking we're dragging existing media */
        body.dragging-file .ProseMirror img,
        body.dragging-file .ProseMirror video {
          pointer-events: none !important;
        }
      `}</style>

      {/* Drop Zone Overlay - shown when dragging files */}
      {isDraggingFile && (
        <div
          className="fixed inset-0 z-50 pointer-events-none"
          style={{
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-blue-500 text-white px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 border-4 border-blue-400 border-dashed">
              <svg
                className="w-16 h-16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <div className="text-center">
                <div className="text-2xl font-bold mb-1">Drop your files here</div>
                <div className="text-blue-100 text-sm">Images and videos supported</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
