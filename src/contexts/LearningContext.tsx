import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../lib/db';
import { escapeHtml, isLearningDashboard, setLearningBridge } from '../lib/learning';
import { isVaultMode } from '../lib/platform';
import { supabase } from '../lib/supabase';
import type { Dashboard, LearningGap, Note } from '../types';
import { useAuth } from './AuthContext';

const GAPS_TABLE = 'learning_gaps';

export interface NewGap {
  passage: string;
  source: string;
  confusion: string;
}

interface LearningContextValue {
  /** The Learning space is available (local vaults only for now). */
  enabled: boolean;
  learningDashboard: Dashboard | null;
  /** The Learning space is the active dashboard. */
  isActive: boolean;
  openSpace: () => Promise<void>;
  leaveSpace: () => Promise<void>;
  /** Every concept note in the Learning space (newest data from this device). */
  learningNotes: Note[];
  openNote: (id: string) => void;
  /** Create a concept note in the Learning space. */
  createConcept: (fields: Partial<Note>, options?: { open?: boolean }) => Promise<Note | null>;

  // Gap inbox
  gaps: LearningGap[];
  addGap: (gap: NewGap) => Promise<boolean>;
  deleteGap: (id: string) => Promise<void>;
  gapToConcept: (id: string) => Promise<void>;
  captureOpen: boolean;
  setCaptureOpen: (open: boolean) => void;
  inboxOpen: boolean;
  setInboxOpen: (open: boolean) => void;
}

const LearningContext = createContext<LearningContextValue | null>(null);

interface LearningProviderProps {
  children: React.ReactNode;
  dashboards: Dashboard[];
  activeDashboard: Dashboard | null;
  /** Notes of the active dashboard — used as a "something changed" signal. */
  notes: Note[] | null;
  openNote: (id: string) => void;
  createNoteWith: (dashboardId: string | null, fields: Partial<Note>, options?: { open?: boolean }) => Promise<Note | null>;
  openLearningSpace: () => Promise<Dashboard | null>;
  leaveLearningSpace: () => Promise<void>;
}

function rankTitle(title: string, q: string): number {
  const t = title.toLowerCase();
  if (!q) return 1;
  if (t === q) return 0;
  if (t.startsWith(q)) return 1;
  if (t.split(/\s+/).some((w) => w.startsWith(q))) return 2;
  return t.includes(q) ? 3 : -1;
}

export function LearningProvider({
  children,
  dashboards,
  activeDashboard,
  notes,
  openNote,
  createNoteWith,
  openLearningSpace,
  leaveLearningSpace,
}: LearningProviderProps) {
  const { user } = useAuth();
  const enabled = isVaultMode();
  const learningDashboard = useMemo(() => dashboards.find((d) => isLearningDashboard(d)) ?? null, [dashboards]);
  const isActive = enabled && isLearningDashboard(activeDashboard);

  const [learningNotes, setLearningNotes] = useState<Note[]>([]);
  const [gaps, setGaps] = useState<LearningGap[]>([]);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);

  // Keep a fresh list of concept notes (for [[links]], backlinks and titles).
  const learningId = learningDashboard?.id ?? null;
  useEffect(() => {
    if (!enabled || !learningId) {
      setLearningNotes([]);
      return;
    }
    let cancelled = false;
    void db.notes
      .where('dashboard_id')
      .equals(learningId)
      .toArray()
      .then((rows) => {
        if (!cancelled) setLearningNotes(rows as unknown as Note[]);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, learningId, notes]);

  const createConcept = useCallback(
    async (fields: Partial<Note>, options: { open?: boolean } = {}) => {
      let dashboardId = learningId;
      if (!dashboardId) dashboardId = (await openLearningSpace())?.id ?? null;
      if (!dashboardId) return null;
      const note = await createNoteWith(dashboardId, { learning_status: 'fuzzy', ...fields }, options);
      if (note) setLearningNotes((prev) => [note, ...prev.filter((n) => n.id !== note.id)]);
      return note;
    },
    [learningId, openLearningSpace, createNoteWith],
  );

  // Bridge for the editor's [[wikilink]] extension.
  const notesRef = useRef(learningNotes);
  notesRef.current = learningNotes;
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const createRef = useRef(createConcept);
  createRef.current = createConcept;
  const openRef = useRef(openNote);
  openRef.current = openNote;

  useEffect(() => {
    if (!enabled) return;
    setLearningBridge({
      isActive: () => isActiveRef.current,
      search: async (query) => {
        const q = query.trim().toLowerCase();
        return notesRef.current
          .map((n) => ({ n, rank: rankTitle(n.title || '', q) }))
          .filter((x) => x.rank >= 0)
          .sort((a, b) => a.rank - b.rank || (a.n.title || '').localeCompare(b.n.title || ''))
          .slice(0, 8)
          .map(({ n }) => ({ id: n.id, title: n.title || 'Untitled', emoji: n.emoji, status: n.learning_status ?? null }));
      },
      create: async (title) => {
        const note = await createRef.current({ title }, { open: false });
        return note ? { id: note.id, title: note.title } : null;
      },
      open: (id) => openRef.current(id),
      title: (id) => notesRef.current.find((n) => n.id === id)?.title,
    });
    return () => setLearningBridge(null);
  }, [enabled]);

  // Titles changed (rename): let link chips re-render.
  useEffect(() => {
    window.dispatchEvent(new Event('learningTitlesChanged'));
  }, [learningNotes]);

  // ---------------------------------------------------------------- gaps

  useEffect(() => {
    if (!enabled || !user?.id) return;
    void supabase
      .from(GAPS_TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setGaps((data as LearningGap[]) ?? []));
  }, [enabled, user?.id]);

  const addGap = useCallback(
    async (gap: NewGap) => {
      if (!user?.id) return false;
      const { data, error } = await supabase
        .from(GAPS_TABLE)
        .insert({
          user_id: user.id,
          passage: gap.passage.trim(),
          source: gap.source.trim() || null,
          confusion: gap.confusion.trim(),
          concept_note_id: null,
        })
        .select()
        .single();
      if (error || !data) {
        console.error('Could not save gap', error);
        return false;
      }
      setGaps((prev) => [data as LearningGap, ...prev]);
      return true;
    },
    [user?.id],
  );

  const deleteGap = useCallback(async (id: string) => {
    await supabase.from(GAPS_TABLE).delete().eq('id', id);
    setGaps((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const gapToConcept = useCallback(
    async (id: string) => {
      const gap = gaps.find((g) => g.id === id);
      if (!gap) return;
      const title = gap.confusion.trim().replace(/\s+/g, ' ').slice(0, 80) || 'New concept';
      const passage = escapeHtml(gap.passage).replace(/\n+/g, '</p><p>');
      const content =
        `<blockquote><p>${passage}</p></blockquote>` +
        (gap.source ? `<p><em>📖 ${escapeHtml(gap.source)}</em></p>` : '') +
        `<p>❓ ${escapeHtml(gap.confusion)}</p><p></p>`;
      const note = await createConcept({ title, content, source: gap.source, learning_status: 'fuzzy' });
      if (!note) return;
      const now = new Date().toISOString();
      await supabase.from(GAPS_TABLE).update({ concept_note_id: note.id, updated_at: now }).eq('id', id);
      setGaps((prev) => prev.map((g) => (g.id === id ? { ...g, concept_note_id: note.id, updated_at: now } : g)));
      setInboxOpen(false);
    },
    [gaps, createConcept],
  );

  // Ctrl/Cmd + Shift + G: capture a gap from anywhere in the app.
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setCaptureOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);

  const value: LearningContextValue = {
    enabled,
    learningDashboard,
    isActive,
    openSpace: async () => {
      await openLearningSpace();
    },
    leaveSpace: leaveLearningSpace,
    learningNotes,
    openNote,
    createConcept,
    gaps,
    addGap,
    deleteGap,
    gapToConcept,
    captureOpen,
    setCaptureOpen,
    inboxOpen,
    setInboxOpen,
  };

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>;
}

/** Learning state, or null outside the dashboard (e.g. the Tasks page). */
export function useLearning(): LearningContextValue | null {
  return useContext(LearningContext);
}

/** True when this note lives in the 🧠 Learning space. */
export function useIsConceptNote(note: Note | undefined): boolean {
  const learning = useLearning();
  return Boolean(
    note && learning?.enabled && learning.learningDashboard && note.dashboard_id === learning.learningDashboard.id,
  );
}

