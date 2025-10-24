import { useState, useRef, useEffect } from 'react';
import { Folder, FolderOpen, ChevronRight, ChevronDown, Trash2, Edit3, Smile, Plus, FolderPlus } from 'lucide-react';
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
    setContextMenuPos({ x: e.clientX, y: e.clientY });
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
    <>
      <div
        className="group relative px-2 py-1.5 rounded cursor-pointer hover:bg-[#252525] transition-colors"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={onToggle}
        onContextMenu={handleContextMenu}
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
              <FolderOpen className="w-4 h-4 text-[#D97706]" />
            ) : (
              <Folder className="w-4 h-4 text-[#D97706]" />
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
              onClick={handleDelete}
              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-[#252525] flex items-center gap-3"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <EmojiPicker
          position={contextMenuPos}
          onSelect={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}
    </>
  );
};
