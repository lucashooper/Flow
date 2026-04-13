import { useState, useRef, useEffect } from 'react';
import { Folder, FolderOpen, ChevronRight, ChevronDown, Trash2, Edit3, Smile, Plus, FolderPlus, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Folder as FolderType } from '../types';
import { EmojiPicker } from './EmojiPicker';

interface FolderItemProps {
  folder: FolderType;
  depth: number;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (folderId: string, updates: Partial<FolderType>) => void;
  onDelete: (folderId: string) => void;
  onCreateNote: () => void;
  onCreateSubfolder: () => void;
  autoRenameId?: string;
  onRenameStarted?: (folderId: string) => void;
  notes?: any[];
}

export const FolderItem = ({
  folder,
  depth,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
  onCreateNote,
  onCreateSubfolder,
  autoRenameId,
  onRenameStarted,
  notes = [],
}: FolderItemProps) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(folder.name);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  // Enter rename mode automatically for freshly-created folder
  useEffect(() => {
    if (autoRenameId && autoRenameId === folder.id && !isRenaming) {
      setIsRenaming(true);
      onRenameStarted && onRenameStarted(folder.id);
    }
  }, [autoRenameId, folder.id, isRenaming, onRenameStarted]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setShowContextMenu(false);
        setShowEmojiPicker(false);
      }
    };

    if (showContextMenu || showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showContextMenu, showEmojiPicker]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const menuWidth = 200;
    const menuHeight = 320;
    const padding = 8;
    
    let x = e.clientX;
    let y = e.clientY;
    
    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding;
    }
    if (x < padding) x = padding;
    
    if (y + menuHeight > window.innerHeight - padding) {
      y = Math.max(padding, y - menuHeight);
    }
    
    setContextMenuPos({ x, y });
    setShowContextMenu(true);
  };

  const handleRename = () => {
    setShowContextMenu(false);
    setIsRenaming(true);
  };

  const handleRenameSubmit = () => {
    if (newName.trim()) {
      onUpdate(folder.id, { name: newName.trim() });
    }
    setIsRenaming(false);
  };

  const handleDelete = () => {
    onDelete(folder.id);
    setShowContextMenu(false);
  };

  const handleExportFolder = () => {
    setShowContextMenu(false);
    
    // Get all notes in this folder
    const folderNotes = notes.filter(note => note.folder_id === folder.id);
    
    if (folderNotes.length === 0) {
      alert('No notes to export in this folder');
      return;
    }
    
    // Create export content
    let exportContent = `# ${folder.name}\n\n`;
    exportContent += `Exported from Flow on ${new Date().toLocaleDateString()}\n`;
    exportContent += `Total notes: ${folderNotes.length}\n\n`;
    exportContent += '='.repeat(80) + '\n\n';
    
    folderNotes.forEach((note, index) => {
      exportContent += `## Note ${index + 1}: ${note.title || 'Untitled'}\n\n`;
      
      // Strip HTML tags from content
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = note.content || '';
      const plainText = tempDiv.textContent || tempDiv.innerText || '';
      
      exportContent += plainText + '\n\n';
      exportContent += '-'.repeat(80) + '\n\n';
    });
    
    // Create and download file
    const blob = new Blob([exportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${folder.name.replace(/[^a-z0-9]/gi, '_')}_export.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleEmojiSelect = (emoji: string) => {
    onUpdate(folder.id, { emoji });
    setShowEmojiPicker(false);
    setShowContextMenu(false);
  };

  const handleRemoveEmoji = () => {
    onUpdate(folder.id, { emoji: null });
    setShowContextMenu(false);
  };

  return (
    <div
      className="group relative"
      onContextMenu={handleContextMenu}
      style={{ paddingLeft: `${depth * 16}px` }}
      data-folder-id={folder.id}
    >
      <div
        className="px-2 py-1.5 rounded cursor-pointer hover:bg-[#252525] transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-[#888888]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[#888888]" />
            )}
          </div>
          
          <div className="flex-shrink-0">
            {folder.emoji ? (
              <span className="text-sm">{folder.emoji}</span>
            ) : isExpanded ? (
              <FolderOpen className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            ) : (
              <Folder className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            )}
          </div>

          {isRenaming ? (
            <input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') {
                  setNewName(folder.name);
                  setIsRenaming(false);
                }
              }}
              className="flex-1 px-1 py-0.5 bg-[#0a0a0a] border border-[#A0522D] rounded text-sm text-[#e5e5e5] focus:outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="flex-1 text-sm text-[#e5e5e5] truncate font-medium">
              {folder.name}
            </span>
          )}
        </div>
      </div>

      {/* Context Menu */}
      <AnimatePresence>
        {showContextMenu && (
          <motion.div
            ref={contextMenuRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="fixed z-50 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl py-1 min-w-[200px]"
            style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
          >
            <button
              onClick={() => {
                onCreateNote();
                setShowContextMenu(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] flex items-center gap-3"
            >
              <Plus className="w-4 h-4" />
              New note in folder
            </button>

            <button
              onClick={() => {
                onCreateSubfolder();
                setShowContextMenu(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] flex items-center gap-3"
            >
              <FolderPlus className="w-4 h-4" />
              New subfolder
            </button>

            <div className="my-1 border-t border-[#2a2a2a]" />

            <button
              onClick={handleRename}
              className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] flex items-center gap-3"
            >
              <Edit3 className="w-4 h-4" />
              Rename
            </button>

            <button
              onClick={() => {
                setShowContextMenu(false);
                setShowEmojiPicker(true);
              }}
              className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] flex items-center gap-3"
            >
              <Smile className="w-4 h-4" />
              {folder.emoji ? 'Change emoji' : 'Add emoji'}
            </button>

            {folder.emoji && (
              <button
                onClick={handleRemoveEmoji}
                className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] flex items-center gap-3"
              >
                <Smile className="w-4 h-4" />
                Remove emoji
              </button>
            )}

            <div className="my-1 border-t border-[#2a2a2a]" />

            <button
              onClick={handleExportFolder}
              className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] flex items-center gap-3"
            >
              <Download className="w-4 h-4" />
              Export folder
            </button>

            <div className="my-1 border-t border-[#2a2a2a]" />

            <button
              onClick={handleDelete}
              className="w-full px-4 py-2 text-left text-sm text-[#ff4444] hover:bg-[#252525] flex items-center gap-3"
            >
              <Trash2 className="w-4 h-4" />
              Delete folder
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {showEmojiPicker && (
        <EmojiPicker
          position={contextMenuPos}
          onSelect={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}
    </div>
  );
};
