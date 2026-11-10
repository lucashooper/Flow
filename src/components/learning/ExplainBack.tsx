import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, History, KeyRound, Loader2, X } from 'lucide-react';
import { useLearning } from '../../contexts/LearningContext';
import { describeAiError, hasApiKey, saveApiKey } from '../../lib/ai/claude';
import { VoiceButton } from '../VoiceButton';
import { critiqueExplanation, type Critique } from '../../lib/ai/explainBack';
import { escapeHtml, LEARNING_STATUSES, linkedNoteIds } from '../../lib/learning';
import type { LearningExplanation, Note } from '../../types';

const DRAFT_KEY = (noteId: string) => `flow_explain_draft:${noteId}`;

function keychainName(): string {
  if (/Windows/i.test(navigator.userAgent)) return 'Windows Credential Manager';
  if (/Mac/i.test(navigator.userAgent)) return 'macOS Keychain';
  return 'your system keychain';
}

/** Paste an Anthropic API key once; it goes straight into the OS keychain. */
export function ApiKeyForm({ onSaved }: { onSaved: () => void }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-elev)' }}>
      <div className="flex items-center gap-2 text-sm font-medium mb-1">
        <KeyRound className="w-4 h-4" style={{ color: 'var(--accent)' }} /> Add your Anthropic API key
      </div>
      <p className="text-xs mb-3" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
        Create one at console.anthropic.com → API Keys. It's saved in {keychainName()}, never in your vault, and only sent to
        Anthropic. Usage is billed to your Anthropic account.
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-ant-…"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none font-mono"
          style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--divider)', color: 'var(--text)' }}
        />
        <button
          type="button"
          disabled={!key.trim() || saving}
          onClick={async () => {
            setSaving(true);
            setError('');
            try {
              await saveApiKey(key);
              setKey('');
              onSaved();
            } catch (e) {
              setError(String(e));
            } finally {
              setSaving(false);
            }
          }}
          className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          Save
        </button>
      </div>
      {error && <p className="text-xs mt-2" style={{ color: '#f87171' }}>{error}</p>}
    </div>
  );
}

function Section({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h4 className="text-xs uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
        {emoji} {title}
      </h4>
      {children}
    </div>
  );
}

function CritiqueView({ note, critique, onRetry }: { note: Note; critique: Critique; onRetry: () => void }) {
  const learning = useLearning();
  // Links already in the note count as done.
  const [done, setDone] = useState<Set<string>>(() => {
    const linked = linkedNoteIds(note.content);
    const titles = new Set(
      (learning?.learningNotes ?? []).filter((n) => linked.has(n.id)).map((n) => (n.title || '').toLowerCase()),
    );
    return new Set([
      ...critique.link_existing.filter((l) => titles.has(l.title.toLowerCase())).map((l) => `link:${l.title}`),
      ...critique.new_prerequisites.filter((p) => titles.has(p.title.toLowerCase())).map((p) => `new:${p.title}`),
    ]);
  });
  const mark = (k: string) => setDone((prev) => new Set(prev).add(k));
  const byTitle = useMemo(
    () => new Map((learning?.learningNotes ?? []).map((n) => [(n.title || '').toLowerCase(), n])),
    [learning?.learningNotes],
  );
  if (!learning) return null;

  const quoteList = (items: { quote: string; issue: string }[]) => (
    <ul className="flex flex-col gap-2">
      {items.map((it, i) => (
        <li key={i} className="text-sm" style={{ lineHeight: 1.55 }}>
          <span className="italic" style={{ color: 'var(--muted)' }}>“{it.quote}”</span>
          <span className="block">{it.issue}</span>
        </li>
      ))}
    </ul>
  );

  const suggested = LEARNING_STATUSES.find((s) => s.value === critique.suggested_status);

  return (
    <div>
      <p className="text-sm mb-4 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg-elev)', lineHeight: 1.55 }}>
        {critique.verdict}
      </p>

      {critique.wrong.length > 0 && <Section emoji="❌" title="What's wrong">{quoteList(critique.wrong)}</Section>}
      {critique.vague.length > 0 && <Section emoji="🌫️" title="Vague">{quoteList(critique.vague)}</Section>}
      {critique.missing.length > 0 && (
        <Section emoji="🧩" title="Missing">
          <ul className="list-disc pl-5 text-sm flex flex-col gap-1" style={{ lineHeight: 1.55 }}>
            {critique.missing.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </Section>
      )}
      {critique.shaky_fundamentals.length > 0 && (
        <Section emoji="🧱" title="Fundamentals you seem shaky on">
          <ul className="flex flex-col gap-1.5 text-sm" style={{ lineHeight: 1.55 }}>
            {critique.shaky_fundamentals.map((f, i) => (
              <li key={i}><strong>{f.concept}</strong>: {f.why}</li>
            ))}
          </ul>
        </Section>
      )}
      {critique.questions.length > 0 && (
        <Section emoji="❓" title="Think about">
          <ul className="flex flex-col gap-2">
            {critique.questions.map((q, i) => (
              <li key={i} className="text-sm px-3 py-2 rounded-lg" style={{ border: '1px solid var(--divider)', lineHeight: 1.55 }}>
                {q}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(critique.link_existing.length > 0 || critique.new_prerequisites.length > 0) && (
        <Section emoji="🔗" title="Connect it">
          <div className="flex flex-col gap-1.5">
            {critique.link_existing.map((l) => {
              const target = byTitle.get(l.title.toLowerCase());
              const k = `link:${l.title}`;
              return (
                <div key={k} className="flex items-start justify-between gap-3 text-sm">
                  <span style={{ lineHeight: 1.5 }}>
                    <strong>[[{l.title}]]</strong> <span style={{ color: 'var(--muted)' }}>— {l.why}</span>
                  </span>
                  <button
                    type="button"
                    disabled={!target || done.has(k)}
                    onClick={() => {
                      if (!target) return;
                      learning.appendLinks(note.id, [{ id: target.id, title: target.title }]);
                      mark(k);
                    }}
                    className="flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium disabled:opacity-50"
                    style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--text)' }}
                  >
                    {done.has(k) ? 'Linked ✓' : 'Link'}
                  </button>
                </div>
              );
            })}
            {critique.new_prerequisites.map((p) => {
              const existing = byTitle.get(p.title.toLowerCase());
              const k = `new:${p.title}`;
              return (
                <div key={k} className="flex items-start justify-between gap-3 text-sm">
                  <span style={{ lineHeight: 1.5 }}>
                    🌱 <strong>{p.title}</strong> <span style={{ color: 'var(--muted)' }}>— {p.why}</span>
                  </span>
                  <button
                    type="button"
                    disabled={done.has(k)}
                    onClick={async () => {
                      mark(k);
                      const target =
                        existing ??
                        (await learning.createConcept(
                          {
                            title: p.title,
                            content: `<p>🌱 Prerequisite for <span data-wikilink="" data-note-id="${note.id}">${escapeHtml(note.title || 'Untitled')}</span>. ${escapeHtml(p.why)}</p><p></p>`,
                          },
                          { open: false },
                        ));
                      if (target) learning.appendLinks(note.id, [{ id: target.id, title: target.title }]);
                    }}
                    className="flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium disabled:opacity-50"
                    style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--text)' }}
                    title="Create a 🟥 concept note for it and link it from this note"
                  >
                    {done.has(k) ? 'Created ✓' : existing ? 'Link' : '＋ Create & link'}
                  </button>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mt-5 pt-4" style={{ borderTop: '1px solid var(--divider)' }}>
        {suggested && suggested.value !== note.learning_status ? (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('learning:setStatus', { detail: { noteId: note.id, status: suggested.value } }))}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--text)' }}
          >
            Set status to {suggested.emoji} {suggested.label}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-1.5 rounded-lg text-sm font-medium"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          Try again from scratch
        </button>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** 🧑‍🏫 Explain it back: write it for a 12-year-old, get critiqued, keep every attempt. */
export function ExplainBackModal({ note, onClose }: { note: Note; onClose: () => void }) {
  const learning = useLearning();
  const [keyReady, setKeyReady] = useState<boolean | null>(null);
  const [text, setText] = useState(() => localStorage.getItem(DRAFT_KEY(note.id)) ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<'write' | 'result' | 'history'>('write');
  const [current, setCurrent] = useState<LearningExplanation | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const attempts = useMemo(
    () => (learning?.explanations ?? []).filter((e) => e.note_id === note.id),
    [learning?.explanations, note.id],
  );

  useEffect(() => {
    hasApiKey().then(setKeyReady).catch(() => setKeyReady(false));
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => {
    if (view === 'write' && keyReady) setTimeout(() => textRef.current?.focus(), 30);
  }, [view, keyReady]);
  useEffect(() => {
    try {
      if (text) localStorage.setItem(DRAFT_KEY(note.id), text);
      else localStorage.removeItem(DRAFT_KEY(note.id));
    } catch {
      /* ignore */
    }
  }, [text, note.id]);

  if (!learning) return null;

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const others = learning.learningNotes.filter((n) => n.id !== note.id).map((n) => n.title || 'Untitled');
      const { critique, model } = await critiqueExplanation({
        title: note.title || 'Untitled',
        source: note.source,
        noteHtml: note.content,
        explanation: text.trim(),
        existingConcepts: others,
        previousExplanation: attempts[0]?.explanation,
      });
      const saved = await learning.saveExplanation(note.id, text.trim(), critique, model);
      setCurrent(
        saved ?? {
          id: 'unsaved',
          user_id: '',
          note_id: note.id,
          explanation: text.trim(),
          critique,
          model,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      );
      setText('');
      setView('result');
    } catch (e) {
      setError(describeAiError(e));
      if (/API key/i.test(describeAiError(e))) setKeyReady(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-start justify-center px-4 py-[6vh] overflow-y-auto"
      // Opaque on purpose: no peeking at the note while explaining.
      style={{ backgroundColor: 'var(--bg-editor, #111)' }}
    >
      <div className="w-full max-w-2xl" style={{ color: 'var(--text)' }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 min-w-0">
            {view !== 'write' && (
              <button type="button" onClick={() => setView('write')} className="p-1 rounded hover:opacity-70" style={{ color: 'var(--muted)' }} title="Back">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-lg font-semibold truncate">🧑‍🏫 Explain it back: {note.title || 'Untitled'}</h2>
          </div>
          <div className="flex items-center gap-1">
            {attempts.length > 0 && (
              <button
                type="button"
                onClick={() => setView('history')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
                style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--muted)' }}
              >
                <History className="w-3.5 h-3.5" /> {attempts.length} attempt{attempts.length === 1 ? '' : 's'}
              </button>
            )}
            <button type="button" onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: 'var(--muted)' }} title="Close (Esc)">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {keyReady === false && view === 'write' && (
          <div className="mb-4">
            <ApiKeyForm onSaved={() => { setKeyReady(true); setError(''); }} />
          </div>
        )}

        {view === 'write' && (
          <>
            <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
              Explain it as if teaching a curious 12-year-old. No peeking at your notes or the book. Claude will point out what's wrong,
              vague or missing, without rewriting it for you.
            </p>
            <textarea
              ref={textRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void submit();
                }
              }}
              rows={12}
              placeholder={`So, ${note.title || 'this'} is basically…`}
              className="w-full rounded-xl px-4 py-3 text-[15px] resize-y focus:outline-none"
              style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--divider)', color: 'var(--text)', lineHeight: 1.65 }}
            />
            {error && <p className="text-sm mt-2" style={{ color: '#f87171' }}>{error}</p>}
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                {busy ? 'Claude is reading your explanation… this can take up to a minute.' : 'Ctrl/⌘ + Enter to submit · 🎤 Speak to say it out loud'}
              </span>
              <span className="flex items-center gap-2">
              <VoiceButton getTarget={() => textRef.current} />
              <button
                type="button"
                disabled={!text.trim() || busy || keyReady === false}
                onClick={() => void submit()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Get critique
              </button>
              </span>
            </div>
          </>
        )}

        {view === 'result' && current && (
          <>
            <details className="mb-4 text-sm">
              <summary className="cursor-pointer" style={{ color: 'var(--muted)' }}>Your explanation</summary>
              <p className="mt-2 whitespace-pre-wrap" style={{ lineHeight: 1.6 }}>{current.explanation}</p>
            </details>
            <CritiqueView note={note} critique={current.critique as Critique} onRetry={() => setView('write')} />
          </>
        )}

        {view === 'history' && (
          <div className="flex flex-col gap-2">
            {attempts.map((a, i) => {
              const c = a.critique as Critique;
              const s = LEARNING_STATUSES.find((x) => x.value === c?.suggested_status);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setCurrent(a);
                    setView('result');
                  }}
                  className="text-left rounded-xl p-3 hover:opacity-90"
                  style={{ backgroundColor: 'var(--bg-elev)' }}
                >
                  <div className="flex items-center justify-between text-xs mb-1" style={{ color: 'var(--muted)' }}>
                    <span>Attempt {attempts.length - i} · {formatDate(a.created_at)}</span>
                    {s && <span>{s.emoji} {s.label}</span>}
                  </div>
                  <p className="text-sm line-clamp-2" style={{ lineHeight: 1.5 }}>{a.explanation}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
