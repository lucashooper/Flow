import { useRef, useEffect } from 'react';
import EmojiPickerReact, { Theme } from 'emoji-picker-react';
import { motion } from 'framer-motion';

interface EmojiPickerProps {
  position: { x: number; y: number };
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export const EmojiPicker = ({ position, onSelect, onClose }: EmojiPickerProps) => {
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <motion.div
      ref={pickerRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="fixed z-50"
      style={{ left: position.x, top: position.y }}
    >
      <EmojiPickerReact
        onEmojiClick={(emojiData) => onSelect(emojiData.emoji)}
        theme={Theme.DARK}
        searchPlaceHolder="Search emojis..."
        width={350}
        height={400}
      />
    </motion.div>
  );
};
