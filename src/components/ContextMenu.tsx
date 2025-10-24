import { useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Type,
  Palette,
  Highlighter,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link as LinkIcon,
  ChevronRight,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  FileText,
  Scissors,
  Copy,
  Clipboard,
  Search,
  List,
} from 'lucide-react';

interface ContextMenuProps {
  editor: Editor | null;
  x: number;
  y: number;
  onClose: () => void;
  selectedText: string;
}

const fontSizes = [
  { label: 'Tiny', value: '0.75rem' },
  { label: 'Small', value: '0.875rem' },
  { label: 'Normal', value: '1rem' },
  { label: 'Large', value: '1.25rem' },
  { label: 'Extra Large', value: '1.5rem' },
  { label: 'Huge', value: '2rem' },
];

const textColors = [
  { label: 'Default', value: '' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Green', value: '#10b981' },
  { label: 'Red', value: '#ef4444' },
  { label: 'White', value: '#e5e5e5' },
];

const highlightColors = [
  { label: 'Yellow', value: '#fef08a' },
  { label: 'Green', value: '#86efac' },
  { label: 'Pink', value: '#fbcfe8' },
  { label: 'Blue', value: '#bfdbfe' },
  { label: 'Orange', value: '#fed7aa' },
];

const bulletColors = [
  { label: 'Default Gray', value: 'gray' },
  { label: 'Premium Purple', value: 'purple' },
  { label: 'Electric Blue', value: 'blue' },
  { label: 'Amber Orange', value: 'amber' },
  { label: 'Emerald Green', value: 'green' },
  { label: 'Hot Pink', value: 'pink' },
];

export const ContextMenu = ({ editor, x, y, onClose, selectedText }: ContextMenuProps) => {
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!editor) return null;

  const MenuItem = ({
    icon: Icon,
    label,
    name,
    onClick,
    hasSubmenu,
    shortcut,
  }: {
    icon: any;
    label: string;
    name: string;
    onClick?: () => void;
    hasSubmenu?: boolean;
    shortcut?: string;
  }) => {
    console.log('🟣 Rendering MenuItem:', name);
    return (
      <button
        onClick={(e) => {
          console.log('🔴 CLICKED MenuItem:', name, 'hasSubmenu:', hasSubmenu);
          e.stopPropagation();
          if (hasSubmenu) {
            const newValue = activeSubmenu === name ? null : name;
            console.log('🔴 Setting activeSubmenu to:', newValue);
            setActiveSubmenu(newValue);
          } else if (onClick) {
            console.log('🔴 Executing onClick for:', name);
            onClick();
          }
        }}
        onMouseEnter={() => {
          console.log('🟡 HOVER MenuItem:', name, 'hasSubmenu:', hasSubmenu);
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          if (hasSubmenu) {
            console.log('🟡 Setting activeSubmenu to:', name);
            setActiveSubmenu(name);
          }
        }}
        onMouseDown={() => {
          console.log('🟠 MOUSE DOWN MenuItem:', name);
        }}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#e5e5e5] hover:bg-[#252525] transition-colors cursor-pointer"
        style={{ pointerEvents: 'auto' }}
      >
        <Icon className="w-4 h-4" />
        <span className="flex-1 text-left">{label}</span>
        {shortcut && <span className="text-xs text-[#888888]">{shortcut}</span>}
        {hasSubmenu && <ChevronRight className="w-4 h-4 text-[#888888]" />}
      </button>
    );
  };

  console.log('🎯 ContextMenu render - activeSubmenu:', activeSubmenu);
  
  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.1 }}
      className="fixed z-50 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl min-w-[240px] overflow-visible"
      style={{ left: x, top: y, pointerEvents: 'auto' }}
      onClick={(e) => {
        console.log('🎯 Context menu clicked');
        e.stopPropagation();
      }}
    >
      <div className="py-1" style={{ overflow: 'visible' }}>
        {/* Font Size */}
        <div 
          className="relative" 
          onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
          onMouseLeave={() => {
            timerRef.current = window.setTimeout(() => {
              setActiveSubmenu(null);
            }, 150);
          }}
        >
          <MenuItem icon={Type} label="Font Size" name="Font Size" hasSubmenu />
          <AnimatePresence mode="wait">
            {(() => {
              console.log('💜 Check activeSubmenu === Font Size:', activeSubmenu === 'Font Size');
              return activeSubmenu === 'Font Size' ? (
                <>
                  {(() => {
                    console.log('🎉 SUBMENU SHOULD RENDER NOW!');
                    return null;
                  })()}
                  <motion.div
                    key="font-size-submenu"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="absolute left-full top-0 ml-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl min-w-[180px] overflow-visible"
                    style={{
                      pointerEvents: 'auto',
                      zIndex: 999999,
                    }}
                    onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
                  >
                    {(() => {
                      console.log('🎊 INSIDE motion.div - rendering buttons');
                      return null;
                    })()}
                    {fontSizes.map((size) => {
                      console.log('🔷 Rendering button:', size.label);
                      return (
                      <button
                        key={size.value}
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log(`🔵 CLICKED FONT SIZE: ${size.value}`);
                          console.log('Editor:', editor);
                          try {
                            const success = editor.chain().focus().setFontSize(size.value).run();
                            console.log('✅ Font size set successfully:', success);
                          } catch (error) {
                            console.error('❌ Font size error:', error);
                          }
                          onClose();
                        }}
                        onMouseDown={() => {
                          console.log('🟡 MOUSE DOWN on:', size.label);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] transition-colors cursor-pointer"
                        style={{ pointerEvents: 'auto' }}
                      >
                        {size.label}
                      </button>
                      );
                    })}
                  </motion.div>
                </>
              ) : null;
            })()}
          </AnimatePresence>
        </div>

        {/* Text Color */}
        <div 
          className="relative" 
          onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
          onMouseLeave={() => {
            timerRef.current = window.setTimeout(() => {
              setActiveSubmenu(null);
            }, 150);
          }}
        >
          <MenuItem icon={Palette} label="Text Color" name="Text Color" hasSubmenu />
          <AnimatePresence>
            {activeSubmenu === 'Text Color' && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="absolute left-full top-0 ml-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl min-w-[180px] overflow-hidden"
              >
                {textColors.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => {
                      console.log(`Attempting to set color to: ${color.label}`);
                      console.log('Editor instance:', editor);
                      const chain = editor.chain().focus();
                      let success;
                      if (color.value) {
                        console.log('Setting color...');
                        success = chain.setColor(color.value).run();
                      } else {
                        console.log('Unsetting color...');
                        success = chain.unsetColor().run();
                      }
                      console.log('Command success:', success);
                      console.log('Attributes after:', editor.getAttributes('textStyle'));
                      onClose();
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] transition-colors flex items-center gap-2"
                  >
                    <div
                      className="w-4 h-4 rounded border border-[#2a2a2a]"
                      style={{ backgroundColor: color.value }}
                    />
                    {color.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Highlight Color */}
        <div 
          className="relative" 
          onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
          onMouseLeave={() => {
            timerRef.current = window.setTimeout(() => {
              setActiveSubmenu(null);
            }, 150);
          }}
        >
          <MenuItem icon={Highlighter} label="Highlight" name="Highlight" hasSubmenu />
          <AnimatePresence>
            {activeSubmenu === 'Highlight' && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="absolute left-full top-0 ml-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl min-w-[180px] overflow-hidden"
              >
                {highlightColors.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => {
                      console.log('Setting highlight:', color.value);
                      try {
                        editor.chain().focus().setHighlight({ color: color.value }).run();
                      } catch (error) {
                        console.error('Highlight error:', error);
                      }
                      onClose();
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] transition-colors flex items-center gap-2"
                  >
                    <div
                      className="w-4 h-4 rounded border border-[#2a2a2a]"
                      style={{ backgroundColor: color.value }}
                    />
                    {color.label}
                  </button>
                ))}
                <button
                  onClick={() => {
                    console.log('Removing highlight');
                    try {
                      editor.chain().focus().unsetHighlight().run();
                    } catch (error) {
                      console.error('Remove highlight error:', error);
                    }
                    onClose();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] transition-colors"
                >
                  Remove Highlight
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bullet Color */}
        <div 
          className="relative" 
          onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
          onMouseLeave={() => {
            timerRef.current = window.setTimeout(() => {
              setActiveSubmenu(null);
            }, 150);
          }}
        >
          <MenuItem icon={List} label="Bullet Style" name="Bullet Style" hasSubmenu />
          <AnimatePresence>
            {activeSubmenu === 'Bullet Style' && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="absolute left-full top-0 ml-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl min-w-[180px] overflow-hidden"
              >
                {bulletColors.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => {
                      console.log('Setting bullet color:', color.value);
                      onClose();
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] transition-colors flex items-center gap-2"
                  >
                    <div className="w-4 h-4 flex items-center justify-center">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ 
                          backgroundColor: color.value === 'gray' ? '#888888' : 
                                         color.value === 'purple' ? '#a855f7' :
                                         color.value === 'blue' ? '#06b6d4' :
                                         color.value === 'amber' ? '#f59e0b' :
                                         color.value === 'green' ? '#10b981' :
                                         color.value === 'pink' ? '#ec4899' : '#888888'
                        }}
                      />
                    </div>
                    {color.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="border-t border-[#2a2a2a] my-1" />

        {/* Format */}
        <div 
          className="relative" 
          onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
          onMouseLeave={() => {
            timerRef.current = window.setTimeout(() => {
              setActiveSubmenu(null);
            }, 150);
          }}
        >
          <MenuItem icon={Bold} label="Format" name="Format" hasSubmenu />
          <AnimatePresence>
            {activeSubmenu === 'Format' && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="absolute left-full top-0 ml-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl min-w-[180px] overflow-hidden"
              >
                <button
                  onClick={() => {
                    editor.chain().focus().toggleBold().run();
                    onClose();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] flex items-center gap-2"
                >
                  <Bold className="w-4 h-4" /> Bold
                </button>
                <button
                  onClick={() => {
                    editor.chain().focus().toggleItalic().run();
                    onClose();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] flex items-center gap-2"
                >
                  <Italic className="w-4 h-4" /> Italic
                </button>
                <button
                  onClick={() => {
                    editor.chain().focus().toggleUnderline().run();
                    onClose();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] flex items-center gap-2"
                >
                  <Underline className="w-4 h-4" /> Underline
                </button>
                <button
                  onClick={() => {
                    editor.chain().focus().toggleStrike().run();
                    onClose();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] flex items-center gap-2"
                >
                  <Strikethrough className="w-4 h-4" /> Strikethrough
                </button>
                <button
                  onClick={() => {
                    editor.chain().focus().toggleCode().run();
                    onClose();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] flex items-center gap-2"
                >
                  <Code className="w-4 h-4" /> Code
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Paragraph */}
        <div 
          className="relative" 
          onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
          onMouseLeave={() => {
            timerRef.current = window.setTimeout(() => {
              setActiveSubmenu(null);
            }, 150);
          }}
        >
          <MenuItem icon={FileText} label="Paragraph" name="Paragraph" hasSubmenu />
          <AnimatePresence>
            {activeSubmenu === 'Paragraph' && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="absolute left-full top-0 ml-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl min-w-[180px] overflow-hidden"
              >
                <button
                  onClick={() => {
                    editor.chain().focus().setParagraph().run();
                    onClose();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525]"
                >
                  Normal Text
                </button>
                <button
                  onClick={() => {
                    editor.chain().focus().toggleHeading({ level: 1 }).run();
                    onClose();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] flex items-center gap-2"
                >
                  <Heading1 className="w-4 h-4" /> Heading 1
                </button>
                <button
                  onClick={() => {
                    editor.chain().focus().toggleHeading({ level: 2 }).run();
                    onClose();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] flex items-center gap-2"
                >
                  <Heading2 className="w-4 h-4" /> Heading 2
                </button>
                <button
                  onClick={() => {
                    editor.chain().focus().toggleHeading({ level: 3 }).run();
                    onClose();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] flex items-center gap-2"
                >
                  <Heading3 className="w-4 h-4" /> Heading 3
                </button>
                <button
                  onClick={() => {
                    editor.chain().focus().toggleBlockquote().run();
                    onClose();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] flex items-center gap-2"
                >
                  <Quote className="w-4 h-4" /> Blockquote
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="my-1 border-t border-[#2a2a2a]" />

        {/* Add Link */}
        <MenuItem
          icon={LinkIcon}
          label="Add Link"
          name="Add Link"
          onClick={() => {
            const url = prompt('Enter URL:');
            if (url) {
              editor.chain().focus().setLink({ href: url }).run();
            }
            onClose();
          }}
          shortcut="⌘K"
        />

        <div className="my-1 border-t border-[#2a2a2a]" />

        {/* Cut, Copy, Paste */}
        <MenuItem
          icon={Scissors}
          label="Cut"
          name="Cut"
          onClick={() => {
            document.execCommand('cut');
            onClose();
          }}
          shortcut="⌘X"
        />
        <MenuItem
          icon={Copy}
          label="Copy"
          name="Copy"
          onClick={() => {
            document.execCommand('copy');
            onClose();
          }}
          shortcut="⌘C"
        />
        <MenuItem
          icon={Clipboard}
          label="Paste"
          name="Paste"
          onClick={() => {
            document.execCommand('paste');
            onClose();
          }}
          shortcut="⌘V"
        />

        <div className="my-1 border-t border-[#2a2a2a]" />

        {/* Search */}
        {selectedText && (
          <MenuItem
            icon={Search}
            label={`Search for "${selectedText.substring(0, 20)}${selectedText.length > 20 ? '...' : ''}"`}
            name="Search"
            onClick={() => {
              window.open(`https://www.google.com/search?q=${encodeURIComponent(selectedText)}`, '_blank');
              onClose();
            }}
          />
        )}
      </div>
    </motion.div>
  );
};
