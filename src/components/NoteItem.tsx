import { useState, useRef, useEffect } from 'react';
import { Trash2, Edit3, Smile, Star, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Note } from '../types';
import { EmojiPicker } from './EmojiPicker';
import { formatDistanceToNow } from '../lib/utils';

interface NoteItemProps {
  note: Note;
  depth: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (noteId: string, updates: Partial<Note>) => void;
  onDelete: (noteId: string) => void;
  isBlurred?: boolean;
  onToggleBlur?: () => void;
}

export const NoteItem = ({ note, depth, isSelected, onSelect, onUpdate, onDelete, isBlurred, onToggleBlur }: NoteItemProps) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(note.title);
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
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleRename = () => {
    setShowContextMenu(false);
    setIsRenaming(true);
  };

  const handleRenameSubmit = () => {
    if (newTitle.trim()) {
      onUpdate(note.id, { title: newTitle.trim() });
    }
    setIsRenaming(false);
  };

  const handleDelete = () => {
    onDelete(note.id);
    setShowContextMenu(false);
  };

  const handleEmojiSelect = (emoji: string) => {
    onUpdate(note.id, { emoji });
    setShowEmojiPicker(false);
    setShowContextMenu(false);
  };

  const handleRemoveEmoji = () => {
    onUpdate(note.id, { emoji: null });
    setShowContextMenu(false);
  };

  const handleToggleStar = () => {
    const currentStarred = note.is_starred ?? false;
    onUpdate(note.id, { is_starred: !currentStarred });
    setShowContextMenu(false);
  };

  const contentPreview = note.content
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[#*`]/g, '') // Remove markdown characters
    .split('\n')
    .find(line => line.trim())
    ?.substring(0, 60) || 'Empty note';

  return (
    <>
      <div
        className={`group relative px-2 py-1.5 rounded cursor-pointer transition-all border-l-2 ${
          isSelected
            ? 'bg-[#1a1a1a] border-[#A0522D]'
            : 'border-transparent hover:bg-[#252525]'
        } ${isBlurred ? 'note-faded' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={onSelect}
        onContextMenu={handleContextMenu}
      >
        <div className="flex items-start gap-2">
          {note.emoji && (
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
              <span className="text-sm">{note.emoji}</span>
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            {isRenaming ? (
              <input
                ref={inputRef}
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') {
                    setNewTitle(note.title);
                    setIsRenaming(false);
                  }
                }}
                className="w-full px-1 py-0.5 bg-[#0a0a0a] border border-[#A0522D] rounded text-sm text-[#e5e5e5] focus:outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="text-sm text-[#e5e5e5] truncate font-medium">
                    {note.title}
                  </div>
                  {(note.is_starred ?? false) && (
                    <Star className="w-3 h-3 fill-yellow-500 text-yellow-500 flex-shrink-0" />
                  )}
                </div>
                <div className="text-xs text-[#888888] truncate">
                  {contentPreview}
                </div>
                <div className="text-xs text-[#666666] mt-0.5">
                  {formatDistanceToNow(note.updated_at)}
                </div>
              </>
            )}
          </div>
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
              onClick={handleToggleStar}
              className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] flex items-center gap-3"
            >
              <Star className={`w-4 h-4 ${(note.is_starred ?? false) ? 'fill-yellow-500 text-yellow-500' : ''}`} />
              {(note.is_starred ?? false) ? 'Unstar' : 'Star'}
            </button>

            <div className="my-1 border-t border-[#2a2a2a]" />

            <button
              onClick={handleRename}
              className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] flex items-center gap-3"
            >
              <Edit3 className="w-4 h-4" />
              Rename
            </button>
            {onToggleBlur && (
              <button
                onClick={() => {
                  onToggleBlur();
                  setShowContextMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] flex items-center gap-3"
              >
                <EyeOff className="w-4 h-4" />
                {isBlurred ? 'Unfade note' : 'Fade note'}
              </button>
            )}
            
            <button
              onClick={() => {
                setShowContextMenu(false);
                setShowEmojiPicker(true);
              }}
              className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] flex items-center gap-3"
            >
              <Smile className="w-4 h-4" />
              {note.emoji ? 'Change emoji' : 'Add emoji'}
            </button>

            {note.emoji && (
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
