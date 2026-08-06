import { Minimize2, Settings } from 'lucide-react';

interface FullscreenControlsProps {
  onExit: () => void;
  onOpenSettings: () => void;
  noteTitle?: string;
}

/** Minimal top-left controls shown in presentation-style fullscreen. */
export function FullscreenControls({ onExit, onOpenSettings, noteTitle }: FullscreenControlsProps) {
  return (
    <div
      className="fixed top-3 left-3 z-[200] flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-opacity duration-200"
      style={{
        background: 'rgba(10, 10, 10, 0.55)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        opacity: 0.45,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.45'; }}
    >
      <button
        type="button"
        onClick={onExit}
        className="p-1.5 rounded hover:bg-white/10 transition-colors"
        title="Exit fullscreen (Esc)"
        style={{ color: 'var(--muted)' }}
      >
        <Minimize2 className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onOpenSettings}
        className="p-1.5 rounded hover:bg-white/10 transition-colors"
        title="Settings"
        style={{ color: 'var(--muted)' }}
      >
        <Settings className="w-3.5 h-3.5" />
      </button>
      {noteTitle && (
        <span className="text-[11px] truncate max-w-[140px] ml-0.5" style={{ color: 'var(--muted)' }}>
          {noteTitle}
        </span>
      )}
      <span className="text-[10px] ml-1 hidden sm:inline" style={{ color: 'var(--muted)', opacity: 0.7 }}>
        Esc
      </span>
    </div>
  );
}
