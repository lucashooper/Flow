/**
 * Spaced repetition (SM-2, the SuperMemo-2 algorithm), with four buttons:
 * Again / Hard / Good / Easy.
 *
 * - Again: you forgot. The card restarts (repetitions = 0), comes back in
 *   this session, and its ease drops.
 * - Hard / Good / Easy: you remembered. The gap grows 1 day → 6 days →
 *   previous gap × ease; Hard grows it less, Easy more.
 */

export type Rating = 'again' | 'hard' | 'good' | 'easy';

export interface SrsState {
  ease: number; // ≥ 1.3, starts at 2.5
  interval_days: number; // days until the next review
  repetitions: number; // successful reviews in a row
  lapses: number; // times forgotten
  due_at: string; // ISO time the card is next due
  last_reviewed_at: string | null;
}

const MIN_EASE = 1.3;
const QUALITY: Record<Rating, number> = { again: 1, hard: 3, good: 4, easy: 5 };
const DAY = 24 * 60 * 60 * 1000;

export function newCardState(now = new Date()): SrsState {
  return { ease: 2.5, interval_days: 0, repetitions: 0, lapses: 0, due_at: now.toISOString(), last_reviewed_at: null };
}

/** Due at 4am local time `days` from now, so a whole day's reviews arrive together. */
function dueInDays(days: number, now: Date): string {
  const d = new Date(now.getTime() + days * DAY);
  d.setHours(4, 0, 0, 0);
  return d.toISOString();
}

export function review(card: SrsState, rating: Rating, now = new Date()): SrsState {
  const q = QUALITY[rating];
  const ease = Math.max(MIN_EASE, card.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  const reviewed = now.toISOString();

  if (rating === 'again') {
    return {
      ease,
      interval_days: 0,
      repetitions: 0,
      lapses: card.lapses + 1,
      due_at: new Date(now.getTime() + 60 * 1000).toISOString(), // back in this session
      last_reviewed_at: reviewed,
    };
  }

  let interval: number;
  if (card.repetitions === 0) interval = rating === 'easy' ? 3 : 1;
  else if (card.repetitions === 1) interval = rating === 'hard' ? 3 : rating === 'easy' ? 8 : 6;
  else {
    const base = Math.max(1, card.interval_days);
    interval = rating === 'hard' ? base * 1.2 : rating === 'easy' ? base * ease * 1.3 : base * ease;
  }
  interval = Math.max(1, Math.round(interval));

  return {
    ease,
    interval_days: interval,
    repetitions: card.repetitions + 1,
    lapses: card.lapses,
    due_at: dueInDays(interval, now),
    last_reviewed_at: reviewed,
  };
}

/** Cards due by the end of today. */
export function isDueToday(card: Pick<SrsState, 'due_at'>, now = new Date()): boolean {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return new Date(card.due_at).getTime() <= end.getTime();
}

/** Human description of when a rating would bring the card back, e.g. "6d". */
export function previewInterval(card: SrsState, rating: Rating, now = new Date()): string {
  const next = review(card, rating, now);
  if (rating === 'again') return '<1m';
  const days = next.interval_days;
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}
