import { useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import { useLearning } from '../../contexts/LearningContext';
import { previewInterval, type Rating } from '../../lib/srs';
import { statusEmoji } from '../../lib/learning';

/** Short sessions: fits in the gap while an agent runs. */
const SESSION_LIMIT = 15;

const RATINGS: { rating: Rating; label: string; key: string; color: string }[] = [
  { rating: 'again', label: 'Again', key: '1', color: '#f87171' },
  { rating: 'hard', label: 'Hard', key: '2', color: '#fbbf24' },
  { rating: 'good', label: 'Good', key: '3', color: '#4ade80' },
  { rating: 'easy', label: 'Easy', key: '4', color: '#60a5fa' },
];

/** 🃏 Daily review: question → Space to reveal → 1–4 to rate. */
export function ReviewSession() {
  const learning = useLearning();
  const open = Boolean(learning?.reviewOpen);
  // The session's queue is fixed when it opens; "Again" cards are re-queued at the end.
  const [queue, setQueue] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draftQ, setDraftQ] = useState('');
  const [draftA, setDraftA] = useState('');

  useEffect(() => {
    if (!open || !learning) return;
    setQueue(learning.dueCards.slice(0, SESSION_LIMIT).map((c) => c.id));
    setRevealed(false);
    setDoneCount(0);
    setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const card = useMemo(() => learning?.cards.find((c) => c.id === queue[0]) ?? null, [learning?.cards, queue]);
  const note = useMemo(() => learning?.learningNotes.find((n) => n.id === card?.note_id) ?? null, [learning?.learningNotes, card]);

  const close = () => learning?.setReviewOpen(false);

  const rate = async (rating: Rating) => {
    if (!card || !learning) return;
    await learning.rateCard(card.id, rating);
    setQueue((q) => (rating === 'again' ? [...q.slice(1), q[0]] : q.slice(1)));
    if (rating !== 'again') setDoneCount((n) => n + 1);
    setRevealed(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (editing) return;
      if (e.key === 'Escape') close();
      else if ((e.key === ' ' || e.key === 'Enter') && !revealed) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed) {
        const r = RATINGS.find((x) => x.key === e.key);
        if (r) {
          e.preventDefault();
          void rate(r.rating);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!learning || !open) return null;
  const total = doneCount + queue.length;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
      <div
        className="w-full max-w-xl rounded-2xl p-6 shadow-2xl"
        style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--divider)', color: 'var(--text)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm" style={{ color: 'var(--muted)' }}>
            🃏 Review {card ? `· ${doneCount + 1} of ${total}` : ''}
          </span>
          <button type="button" onClick={close} className="p-1 rounded hover:opacity-70" style={{ color: 'var(--muted)' }} title="Done for now (Esc)">
            <X className="w-5 h-5" />
          </button>
        </div>

        {total > 0 && (
          <div className="h-1 rounded-full mb-5 overflow-hidden" style={{ backgroundColor: 'var(--bg-elev)' }}>
            <div className="h-full transition-all" style={{ width: `${(doneCount / total) * 100}%`, backgroundColor: 'var(--accent)' }} />
          </div>
        )}

        {!card ? (
          <div className="py-10 text-center">
            <p className="text-2xl mb-2">🎉</p>
            <p className="text-sm mb-1">{doneCount ? `Done! ${doneCount} card${doneCount === 1 ? '' : 's'} reviewed.` : 'Nothing due right now.'}</p>
            <p className="text-xs mb-5" style={{ color: 'var(--muted)' }}>
              {learning.dueCards.length ? `${learning.dueCards.length} more due today.` : "You're all caught up for today."}
            </p>
            <button type="button" onClick={close} className="px-4 py-1.5 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
              Back to notes
            </button>
          </div>
        ) : (
          <>
            {note && (
              <button
                type="button"
                onClick={() => {
                  close();
                  learning.openNote(note.id);
                }}
                className="text-xs mb-2 hover:underline"
                style={{ color: 'var(--muted)' }}
                title="Open the note"
              >
                {note.emoji || '📄'} {note.title} {statusEmoji(note.learning_status)}
              </button>
            )}

            {editing ? (
              <div className="flex flex-col gap-2 mb-4">
                <textarea value={draftQ} onChange={(e) => setDraftQ(e.target.value)} rows={2} className="w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none" style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--text)' }} />
                <textarea value={draftA} onChange={(e) => setDraftA(e.target.value)} rows={3} className="w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none" style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--text)' }} />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setEditing(false)} className="px-3 py-1 rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-elev)' }}>Cancel</button>
                  <button
                    type="button"
                    onClick={async () => {
                      await learning.updateCard(card.id, { question: draftQ.trim(), answer: draftA.trim() });
                      setEditing(false);
                    }}
                    className="px-3 py-1 rounded-lg text-xs font-medium"
                    style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-lg font-medium mb-4" style={{ lineHeight: 1.5 }}>{card.question}</p>
                {revealed ? (
                  <p className="text-[15px] mb-6 pt-4 whitespace-pre-wrap" style={{ borderTop: '1px solid var(--divider)', lineHeight: 1.6 }}>
                    {card.answer}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRevealed(true)}
                    className="w-full py-3 rounded-xl text-sm mb-2"
                    style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--muted)' }}
                  >
                    Say it in your head, then show the answer <span className="opacity-60">(Space)</span>
                  </button>
                )}
              </>
            )}

            {revealed && !editing && (
              <div className="grid grid-cols-4 gap-2">
                {RATINGS.map((r) => (
                  <button
                    key={r.rating}
                    type="button"
                    onClick={() => void rate(r.rating)}
                    className="flex flex-col items-center py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-85"
                    style={{ backgroundColor: 'var(--bg-elev)', border: `1px solid ${r.color}55`, color: r.color }}
                  >
                    {r.label}
                    <span className="text-[10px] font-normal" style={{ color: 'var(--muted)' }}>
                      {r.key} · {previewInterval(card, r.rating)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {!editing && (
              <div className="flex justify-end gap-1 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setDraftQ(card.question);
                    setDraftA(card.answer);
                    setEditing(true);
                  }}
                  className="p-1.5 rounded hover:opacity-70"
                  style={{ color: 'var(--muted)' }}
                  title="Edit card"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await learning.deleteCard(card.id);
                    setQueue((q) => q.slice(1));
                    setRevealed(false);
                  }}
                  className="p-1.5 rounded hover:opacity-70"
                  style={{ color: 'var(--muted)' }}
                  title="Delete card"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
