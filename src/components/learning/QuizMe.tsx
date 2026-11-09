import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { useLearning } from '../../contexts/LearningContext';
import { describeAiError, hasApiKey } from '../../lib/ai/claude';
import type { Critique } from '../../lib/ai/explainBack';
import { draftFlashcards, type DraftCard } from '../../lib/ai/flashcards';
import type { Note } from '../../types';
import { ApiKeyForm } from './ExplainBack';

const field = 'w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none';
const fieldStyle = { backgroundColor: 'var(--bg-panel)', border: '1px solid var(--divider)', color: 'var(--text)' };

function CardEditor({
  card,
  index,
  onChange,
  onDelete,
}: {
  card: DraftCard;
  index: number;
  onChange: (c: DraftCard) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-elev)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs" style={{ color: 'var(--muted)' }}>Card {index + 1}</span>
        <button type="button" onClick={onDelete} className="p-1 rounded hover:opacity-70" style={{ color: 'var(--muted)' }} title="Delete card">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <textarea
        value={card.question}
        onChange={(e) => onChange({ ...card, question: e.target.value })}
        rows={2}
        placeholder="Question"
        className={`${field} font-medium mb-1.5`}
        style={fieldStyle}
      />
      <textarea
        value={card.answer}
        onChange={(e) => onChange({ ...card, answer: e.target.value })}
        rows={3}
        placeholder="Answer"
        className={field}
        style={fieldStyle}
      />
    </div>
  );
}

/** 🃏 Quiz me: draft 3–5 cards from my latest explanation, edit, then save. */
export function QuizMeModal({ note, onClose }: { note: Note; onClose: () => void }) {
  const learning = useLearning();
  const latest = useMemo(
    () => (learning?.explanations ?? []).find((e) => e.note_id === note.id) ?? null,
    [learning?.explanations, note.id],
  );
  const existing = useMemo(() => (learning?.cards ?? []).filter((c) => c.note_id === note.id), [learning?.cards, note.id]);
  const [keyReady, setKeyReady] = useState<boolean | null>(null);
  const [drafts, setDrafts] = useState<DraftCard[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<number | null>(null);

  const draft = async () => {
    if (!latest) return;
    setBusy(true);
    setError('');
    try {
      const cards = await draftFlashcards({
        title: note.title || 'Untitled',
        explanation: latest.explanation,
        critique: latest.critique as Critique,
      });
      setDrafts(cards);
    } catch (e) {
      setError(describeAiError(e));
      if (/API key/i.test(describeAiError(e))) setKeyReady(false);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    hasApiKey()
      .then((ok) => {
        setKeyReady(ok);
        if (ok && latest) void draft();
      })
      .catch(() => setKeyReady(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!learning) return null;
  const valid = drafts.filter((d) => d.question.trim() && d.answer.trim());

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-start justify-center px-4 py-[6vh] overflow-y-auto"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl p-5 shadow-2xl"
        style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--divider)', color: 'var(--text)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold truncate">🃏 Quiz me: {note.title || 'Untitled'}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: 'var(--muted)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
          Cards come from your latest explanation, not the book. Edit or delete any before saving.
          {existing.length > 0 && ` This note already has ${existing.length} card${existing.length === 1 ? '' : 's'}.`}
        </p>

        {!latest ? (
          <p className="text-sm py-6 text-center" style={{ color: 'var(--muted)' }}>
            Use 🧑‍🏫 <strong>Explain it back</strong> on this note first. Your cards are made from your own explanation.
          </p>
        ) : keyReady === false ? (
          <ApiKeyForm
            onSaved={() => {
              setKeyReady(true);
              void draft();
            }}
          />
        ) : busy ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: 'var(--muted)' }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Drafting cards from your explanation…
          </div>
        ) : saved !== null ? (
          <div className="py-8 text-center">
            <p className="text-sm mb-4">Saved {saved} card{saved === 1 ? '' : 's'} ✓ They're due for review today.</p>
            <div className="flex justify-center gap-2">
              <button type="button" onClick={onClose} className="px-4 py-1.5 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-elev)' }}>
                Done
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  learning.setReviewOpen(true);
                }}
                className="px-4 py-1.5 rounded-lg text-sm font-medium"
                style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
              >
                Review now
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
              {drafts.map((d, i) => (
                <CardEditor
                  key={i}
                  card={d}
                  index={i}
                  onChange={(c) => setDrafts((prev) => prev.map((x, j) => (j === i ? c : x)))}
                  onDelete={() => setDrafts((prev) => prev.filter((_, j) => j !== i))}
                />
              ))}
            </div>
            {error && <p className="text-sm mt-3" style={{ color: '#f87171' }}>{error}</p>}
            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setDrafts((prev) => [...prev, { question: '', answer: '' }])}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs"
                  style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--text)' }}
                >
                  <Plus className="w-3.5 h-3.5" /> Card
                </button>
                <button
                  type="button"
                  onClick={() => void draft()}
                  className="px-2.5 py-1.5 rounded-lg text-xs"
                  style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--muted)' }}
                >
                  Redraft
                </button>
              </div>
              <button
                type="button"
                disabled={!valid.length}
                onClick={async () => setSaved(await learning.addCards(note.id, valid))}
                className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
                style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
              >
                Save {valid.length} card{valid.length === 1 ? '' : 's'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
