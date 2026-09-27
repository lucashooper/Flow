import { useEffect, useRef, useState } from 'react';
import { Cloud, HardDrive, Loader2, AlertCircle } from 'lucide-react';
import type { NoteSavePhase } from '../lib/noteDrafts';

interface NoteSaveStatusProps {
  noteId: string | undefined;
  restoredFromDraft?: boolean;
}

const LABELS: Record<NoteSavePhase, string> = {
  idle: '',
  local: 'Saved to local',
  syncing: 'Syncing…',
  cloud: 'Saved to cloud',
  failed: 'Sync failed (retrying)',
};

/** Minimum time the syncing pill stays visible to avoid flicker. */
const MIN_SYNC_DISPLAY_MS = 400;

export const NoteSaveStatus = ({ noteId, restoredFromDraft }: NoteSaveStatusProps) => {
  const [phase, setPhase] = useState<NoteSavePhase>('idle');
  const [message, setMessage] = useState('');
  const phaseRef = useRef<NoteSavePhase>('idle');
  const phaseShownAtRef = useRef(0);
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!noteId) {
      setPhase('idle');
      phaseRef.current = 'idle';
      return;
    }

    const applyPhase = (nextPhase: NoteSavePhase, nextMessage: string) => {
      phaseRef.current = nextPhase;
      phaseShownAtRef.current = Date.now();
      setPhase(nextPhase);
      setMessage(nextMessage);
    };

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ noteId: string; phase: NoteSavePhase; message?: string }>).detail;
      if (detail.noteId !== noteId) return;

      const nextPhase = detail.phase;
      const nextMessage = detail.message ?? LABELS[nextPhase] ?? '';
      const currentPhase = phaseRef.current;
      const elapsed = Date.now() - phaseShownAtRef.current;

      if (pendingRef.current) {
        clearTimeout(pendingRef.current);
        pendingRef.current = null;
      }

      // Keep "Syncing…" visible for at least 400ms before showing a settled state
      const leavingSync =
        currentPhase === 'syncing' &&
        (nextPhase === 'cloud' || nextPhase === 'local' || nextPhase === 'idle');

      if (leavingSync && elapsed < MIN_SYNC_DISPLAY_MS) {
        pendingRef.current = setTimeout(() => {
          applyPhase(nextPhase, nextMessage);
          pendingRef.current = null;
        }, MIN_SYNC_DISPLAY_MS - elapsed);
        return;
      }

      // Debounce rapid local flashes while typing — only show local if it persists
      if (nextPhase === 'local' && currentPhase !== 'local') {
        pendingRef.current = setTimeout(() => {
          if (phaseRef.current === 'syncing') return;
          applyPhase('local', nextMessage);
          pendingRef.current = null;
        }, MIN_SYNC_DISPLAY_MS);
        return;
      }

      applyPhase(nextPhase, nextMessage);
    };

    window.addEventListener('noteSaveStatus', handler);
    return () => {
      window.removeEventListener('noteSaveStatus', handler);
      if (pendingRef.current) clearTimeout(pendingRef.current);
    };
  }, [noteId]);

  if (!noteId) return null;

  const label = message || LABELS[phase];

  return (
    <div className="flex items-center gap-2 flex-wrap mt-1">
      {restoredFromDraft && (
        <span
          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
          style={{
            color: '#fbbf24',
            backgroundColor: 'rgba(251, 191, 36, 0.12)',
            border: '1px solid rgba(251, 191, 36, 0.25)',
          }}
        >
          Unsaved local changes restored
        </span>
      )}

      {phase !== 'idle' && label && (
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full"
          style={{
            color:
              phase === 'failed'
                ? '#f87171'
                : phase === 'cloud'
                  ? '#4ade80'
                  : phase === 'syncing'
                    ? '#60a5fa'
                    : 'var(--muted, #888)',
            backgroundColor:
              phase === 'failed'
                ? 'rgba(248, 113, 113, 0.1)'
                : phase === 'cloud'
                  ? 'rgba(74, 222, 128, 0.1)'
                  : phase === 'syncing'
                    ? 'rgba(96, 165, 250, 0.1)'
                    : 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            transition: 'opacity 0.2s ease',
          }}
        >
          {phase === 'local' && <HardDrive className="w-3 h-3" />}
          {phase === 'syncing' && <Loader2 className="w-3 h-3 animate-spin" />}
          {phase === 'cloud' && <Cloud className="w-3 h-3" />}
          {phase === 'failed' && <AlertCircle className="w-3 h-3" />}
          {label}
        </span>
      )}
    </div>
  );
};
