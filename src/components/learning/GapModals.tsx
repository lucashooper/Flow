import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Inbox, Trash2, X } from 'lucide-react';
import { useLearning } from '../../contexts/LearningContext';

import { VoiceButton } from '../VoiceButton';

const LAST_SOURCE_KEY = 'flow_last_gap_source';

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-[9998] flex items-start justify-center px-4 pt-[12vh]"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-5 shadow-2xl"
        style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--divider)', color: 'var(--text)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

const field = 'w-full rounded-lg px-3 py-2 text-sm focus:outline-none';
const fieldStyle = { backgroundColor: 'var(--bg-elev)', border: '1px solid var(--divider)', color: 'var(--text)' };

/** "＋ Gap": paste the confusing passage, where it's from, and what's unclear. */
export function GapCaptureModal() {
  const learning = useLearning();
  const open = Boolean(learning?.captureOpen);
  const [passage, setPassage] = useState('');
  const [source, setSource] = useState('');
  const [confusion, setConfusion] = useState('');
  const [saving, setSaving] = useState(false);
  const passageRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setPassage('');
    setConfusion('');
    setSource(localStorage.getItem(LAST_SOURCE_KEY) ?? '');
    setTimeout(() => passageRef.current?.focus(), 30);
  }, [open]);

  if (!learning || !open) return null;
  const close = () => learning.setCaptureOpen(false);
  const canSave = passage.trim().length > 0 && confusion.trim().length > 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const ok = await learning.addGap({ passage, source, confusion });
    setSaving(false);
    if (ok) {
      localStorage.setItem(LAST_SOURCE_KEY, source.trim());
      close();
    }
  };

  return (
    <Overlay onClose={close}>
      <div
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void save();
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">🕳️ Capture a gap</h2>
          <button type="button" onClick={close} className="p-1 rounded hover:opacity-70" style={{ color: 'var(--muted)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <textarea
          ref={passageRef}
          value={passage}
          onChange={(e) => setPassage(e.target.value)}
          placeholder="Paste the paragraph that lost you…"
          rows={5}
          className={`${field} resize-y mb-2`}
          style={fieldStyle}
        />
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="📖 Source — book title, p. 42"
          className={`${field} mb-2`}
          style={fieldStyle}
        />
        <input
          value={confusion}
          onChange={(e) => setConfusion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void save();
            }
          }}
          placeholder="❓ What confuses me, in one line"
          className={field}
          style={fieldStyle}
        />
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            Ctrl/⌘ + Enter to save · Ctrl/⌘ + Shift + G to open from anywhere
          </span>
          <span className="flex items-center gap-2">
          <VoiceButton getTarget={() => document.querySelector<HTMLInputElement>('input[placeholder^="❓"]')} />
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void save()}
            className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            Save to inbox
          </button>
          </span>
        </div>
      </div>
    </Overlay>
  );
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** 📥 Gap inbox: unprocessed gaps, each one click away from a concept note. */
export function GapInboxModal() {
  const learning = useLearning();
  const [busyId, setBusyId] = useState<string | null>(null);
  if (!learning || !learning.inboxOpen) return null;
  const close = () => learning.setInboxOpen(false);
  const open = learning.gaps.filter((g) => !g.concept_note_id);

  return (
    <Overlay onClose={close}>
      <div onKeyDown={(e) => e.key === 'Escape' && close()} tabIndex={-1}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Inbox className="w-4 h-4" /> Gap inbox
            <span className="text-xs font-normal" style={{ color: 'var(--muted)' }}>{open.length}</span>
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                close();
                learning.setCaptureOpen(true);
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--text)' }}
            >
              ＋ Gap
            </button>
            <button type="button" onClick={close} className="p-1 rounded hover:opacity-70" style={{ color: 'var(--muted)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {open.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: 'var(--muted)' }}>
            Inbox zero 🎉 Capture a gap whenever a passage loses you.
          </p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
            {open.map((gap) => (
              <div key={gap.id} className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-elev)' }}>
                <div className="text-sm font-medium mb-1">❓ {gap.confusion}</div>
                <p className="text-xs line-clamp-3 mb-2" style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
                  {gap.passage}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                    {gap.source ? `📖 ${gap.source} · ` : ''}
                    {timeAgo(gap.created_at)}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => void learning.deleteGap(gap.id)}
                      className="p-1.5 rounded hover:opacity-70"
                      style={{ color: 'var(--muted)' }}
                      title="Delete gap"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={busyId === gap.id}
                      onClick={async () => {
                        setBusyId(gap.id);
                        await learning.gapToConcept(gap.id);
                        setBusyId(null);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium disabled:opacity-50"
                      style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                      title="Turn into a 🟥 concept note"
                    >
                      Concept <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Overlay>
  );
}
