// Tests for the spaced-repetition scheduler (src/lib/srs.ts). Run: npm run test:srs
import assert from 'node:assert/strict';
import { newCardState, review, isDueToday, previewInterval } from '../src/lib/srs';

const now = new Date('2026-11-09T12:00:00');
let c = newCardState(now);
assert.ok(isDueToday(c, now), 'new cards are due now');

c = review(c, 'good', now);
assert.equal(c.interval_days, 1); assert.equal(c.repetitions, 1); assert.equal(c.ease, 2.5);
assert.ok(!isDueToday(c, now), 'not due again today');

c = review(c, 'good', now);
assert.equal(c.interval_days, 6);
c = review(c, 'good', now);
assert.equal(c.interval_days, 15, '6 × 2.5');

const hard = review(c, 'hard', now);
assert.equal(hard.interval_days, 18, '15 × 1.2'); assert.ok(hard.ease < c.ease);
const easy = review(c, 'easy', now);
assert.ok(easy.interval_days > 15 * 2.5, 'easy grows more than good'); assert.ok(easy.ease > c.ease);

const again = review(c, 'again', now);
assert.equal(again.repetitions, 0); assert.equal(again.lapses, 1); assert.ok(isDueToday(again, now)); assert.ok(again.ease < c.ease);

let low = newCardState(now);
for (let i = 0; i < 20; i++) low = review(low, 'again', now);
assert.equal(low.ease, 1.3, 'ease never drops below 1.3');

assert.equal(previewInterval(newCardState(now), 'good', now), '1d');
assert.equal(previewInterval(newCardState(now), 'again', now), '<1m');
const due = new Date(review(newCardState(now), 'good', now).due_at);
assert.equal(due.getHours(), 4, 'due at 4am');
console.log('srs: all tests passed');
