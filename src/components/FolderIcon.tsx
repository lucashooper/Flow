import { Folder, FolderOpen } from 'lucide-react';
import type { Folder as FolderType } from '../types';

const ICON_SIZE = 16;
/** Zoom past typical transparent padding in uploaded icon PNGs/JPGs. */
const ICON_IMAGE_ZOOM = 1.5;

interface FolderIconProps {
  folder: FolderType;
  isExpanded?: boolean;
}

/** Renders a folder icon: custom image, emoji, or default folder glyph at 16×16. */
export function FolderIcon({ folder, isExpanded = false }: FolderIconProps) {
  if (folder.icon_url) {
    return (
      <div
        className="flex-shrink-0 overflow-hidden rounded-sm"
        style={{ width: ICON_SIZE, height: ICON_SIZE }}
        aria-hidden
      >
        <img
          src={folder.icon_url}
          alt=""
          className="h-full w-full object-cover"
          style={{
            transform: `scale(${ICON_IMAGE_ZOOM})`,
            transformOrigin: 'center',
          }}
          draggable={false}
        />
      </div>
    );
  }

  if (folder.emoji) {
    return (
      <span
        className="flex-shrink-0 flex items-center justify-center leading-none"
        style={{ width: ICON_SIZE, height: ICON_SIZE, fontSize: 14 }}
      >
        {folder.emoji}
      </span>
    );
  }

  return isExpanded ? (
    <FolderOpen className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent)' }} />
  ) : (
    <Folder className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent)' }} />
  );
}
