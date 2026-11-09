import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Link2 } from 'lucide-react';
import { ExplainBackModal } from './ExplainBack';
import { QuizMeModal } from './QuizMe';
import { useLearning } from '../../contexts/LearningContext';
import { LEARNING_STATUSES, linkedNoteIds, statusEmoji } from '../../lib/learning';
import type { Note } from '../../types';

interface PanelProps {
  note: Note;
  onNoteUpdate: (noteId: string, updates: Partial<Note>) => void | Promise<void>;
}

/** Status (🟥 / 🟨 / 🟩) and source line, under a concept note's title. */
export function LearningNoteHeader({ note, onNoteUpdate }: PanelProps) {
  const learning = useLearning();
  const [source, setSource] = useState(note.source ?? '');
  const [explaining, setExplaining] = useState(false);
  const [quizzing, setQuizzing] = useState(false);
  const cardCount = (learning?.cards ?? []).filter((c) => c.note_id === note.id).length;
  useEffect(() => setSource(note.source ?? ''), [note.id, note.source]);
  const attempts = (learning?.explanations ?? []).filter((e) => e.note_id === note.id).length;

  // "Set status" from an Explain-it-back critique
  useEffect(() => {
    const onSet = (e: Event) => {
      const { noteId, status } = (e as CustomEvent<{ noteId: string; status: Note['learning_status'] }>).detail;
      if (noteId === note.id) void onNoteUpdate(note.id, { learning_status: status });
    };
    window.addEventListener('learning:setStatus', onSet);
    return () => window.removeEventListener('learning:setStatus', onSet);
  }, [note.id, onNoteUpdate]);

  const saveSource = () => {
    const next = source.trim() || null;
    if (next !== (note.source ?? null)) void onNoteUpdate(note.id, { source: next });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-2">
      <div className="flex items-center gap-0.5 rounded-full p-0.5" style={{ backgroundColor: 'var(--bg-elev)' }}>
        {LEARNING_STATUSES.map((s) => {
          const active = note.learning_status === s.value;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => void onNoteUpdate(note.id, { learning_status: active ? null : s.value })}
              className="px-2 py-0.5 rounded-full text-xs transition-colors"
              style={{
                backgroundColor: active ? 'var(--bg-panel)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--muted)',
                boxShadow: active ? '0 0 0 1px var(--divider)' : 'none',
              }}
              title={active ? `${s.label} (click to clear)` : s.label}
            >
              {s.emoji} {active && <span className="ml-0.5">{s.label}</span>}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setExplaining(true)}
        className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-opacity hover:opacity-80"
        style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        title="Explain it back: write it for a 12-year-old and get critiqued"
      >
        🧑‍🏫 Explain it back{attempts > 0 && <span className="opacity-80">· {attempts}</span>}
      </button>
      {explaining && <ExplainBackModal note={note} onClose={() => setExplaining(false)} />}
      <button
        type="button"
        onClick={() => setQuizzing(true)}
        disabled={attempts === 0}
        className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
        style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--text)', border: '1px solid var(--divider)' }}
        title={attempts === 0 ? 'Explain it back first: cards are made from your own explanation' : 'Draft flashcards from your latest explanation'}
      >
        🃏 Quiz me{cardCount > 0 && <span className="opacity-70">· {cardCount}</span>}
      </button>
      {quizzing && <QuizMeModal note={note} onClose={() => setQuizzing(false)} />}
      <label className="flex items-center gap-1.5 flex-1 min-w-[200px]">
        <BookOpen className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--muted)' }} />
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          onBlur={saveSource}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Source — book title, p. 42"
          className="flex-1 bg-transparent text-sm focus:outline-none"
          style={{ color: 'var(--muted)' }}
        />
      </label>
    </div>
  );
}

/** "Linked from": the concept notes that [[link]] to this one. */
export function BacklinksPanel({ note }: { note: Note }) {
  const learning = useLearning();
  const backlinks = useMemo(
    () => (learning?.learningNotes ?? []).filter((n) => n.id !== note.id && linkedNoteIds(n.content).has(note.id)),
    [learning?.learningNotes, note.id],
  );
  if (!learning) return null;

  return (
    <div className="mt-10 mb-16 pt-4" style={{ borderTop: '1px solid var(--divider)' }}>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
        <Link2 className="w-3.5 h-3.5" /> Linked from
      </div>
      {backlinks.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--muted)', opacity: 0.7 }}>
          Nothing links here yet. Type <code>[[</code> in another concept note to link to this one.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {backlinks.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => learning.openNote(n.id)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm transition-colors hover:opacity-80"
              style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--text)' }}
            >
              <span>{n.emoji || '📄'}</span>
              <span className="truncate max-w-[220px]">{n.title || 'Untitled'}</span>
              {statusEmoji(n.learning_status) && <span className="text-xs">{statusEmoji(n.learning_status)}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
