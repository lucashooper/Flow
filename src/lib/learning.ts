import type { Dashboard, LearningStatus } from '../types';

/** The three understanding levels shown on concept notes. */
export const LEARNING_STATUSES: { value: LearningStatus; emoji: string; label: string }[] = [
  { value: 'fuzzy', emoji: '🟥', label: 'Fuzzy' },
  { value: 'getting', emoji: '🟨', label: 'Getting it' },
  { value: 'clear', emoji: '🟩', label: 'Can explain it' },
];

export function statusEmoji(status: LearningStatus | null | undefined): string | null {
  return LEARNING_STATUSES.find((s) => s.value === status)?.emoji ?? null;
}

export function isLearningDashboard(d: Pick<Dashboard, 'kind'> | null | undefined): boolean {
  return d?.kind === 'learning';
}

/** Ids of the notes a note links to with [[wikilinks]] (from its saved HTML). */
export function linkedNoteIds(html: string | null | undefined): Set<string> {
  const ids = new Set<string>();
  if (!html || !html.includes('data-wikilink')) return ids;
  for (const m of html.matchAll(/data-note-id="([^"]+)"/g)) ids.add(m[1]);
  return ids;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Bridge between the editor's [[wikilink]] extension (created once per editor,
 * outside React) and the Learning space state (owned by LearningProvider).
 */
export interface LearningBridge {
  /** True while the 🧠 Learning space is the active dashboard. */
  isActive(): boolean;
  /** Learning notes whose title matches the query (best matches first). */
  search(query: string): Promise<{ id: string; title: string; emoji: string | null; status: LearningStatus | null }[]>;
  /** Create a concept note with this title (without opening it). */
  create(title: string): Promise<{ id: string; title: string } | null>;
  /** Open a note. */
  open(id: string): void;
  /** Current title of a note, for showing links after renames. */
  title(id: string): string | undefined;
}

const noop: LearningBridge = {
  isActive: () => false,
  search: async () => [],
  create: async () => null,
  open: () => {},
  title: () => undefined,
};

let bridge: LearningBridge = noop;

export function setLearningBridge(next: LearningBridge | null): void {
  bridge = next ?? noop;
  window.dispatchEvent(new Event('learningTitlesChanged'));
}

export function learningBridge(): LearningBridge {
  return bridge;
}
