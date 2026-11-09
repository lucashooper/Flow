import type Anthropic from '@anthropic-ai/sdk';
import type { LearningStatus } from '../../types';
import { claude } from './claude';

/** Model for critiquing explanations (Phase 3). */
export const CRITIQUE_MODEL = 'claude-opus-5-5';

export interface Critique {
  verdict: string;
  wrong: { quote: string; issue: string }[];
  vague: { quote: string; issue: string }[];
  missing: string[];
  shaky_fundamentals: { concept: string; why: string }[];
  questions: string[];
  link_existing: { title: string; why: string }[];
  new_prerequisites: { title: string; why: string }[];
  suggested_status: LearningStatus;
}

const quoted = {
  type: 'array',
  items: {
    type: 'object',
    properties: { quote: { type: 'string' }, issue: { type: 'string' } },
    required: ['quote', 'issue'],
    additionalProperties: false,
  },
};
const titled = (key: string) => ({
  type: 'array',
  items: {
    type: 'object',
    properties: { [key]: { type: 'string' }, why: { type: 'string' } },
    required: [key, 'why'],
    additionalProperties: false,
  },
});

const CRITIQUE_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string' },
    wrong: quoted,
    vague: quoted,
    missing: { type: 'array', items: { type: 'string' } },
    shaky_fundamentals: titled('concept'),
    questions: { type: 'array', items: { type: 'string' } },
    link_existing: titled('title'),
    new_prerequisites: titled('title'),
    suggested_status: { type: 'string', enum: ['fuzzy', 'getting', 'clear'] },
  },
  required: [
    'verdict',
    'wrong',
    'vague',
    'missing',
    'shaky_fundamentals',
    'questions',
    'link_existing',
    'new_prerequisites',
    'suggested_status',
  ],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are a demanding but warm tutor running the Feynman technique. The learner reads dense non-fiction and is closing "explanatory gaps". They have just explained a concept in their own words, as if teaching a curious 12-year-old, without looking at their source.

Your job is to find where their understanding breaks, not to teach the concept for them:
- Never rewrite their explanation or give a model answer. Point at problems and let them do the thinking.
- "wrong": statements that are incorrect. Quote their exact words in "quote", then say briefly what's wrong and why it matters.
- "vague": hand-waving, jargon used without being explained, circular definitions, or "it just does X" leaps. Quote their words and say what a 12-year-old would still be unable to picture.
- "missing": important parts of the idea their explanation leaves out entirely.
- "shaky_fundamentals": underlying concepts their explanation suggests they don't firmly hold (for example "matrix multiplication" or "what a foreign key is"), each with why you think so.
- "questions": exactly one or two probing follow-up questions that would expose whether they really understand: ask about why or how, not trivia.
- "link_existing": concepts from the provided list of their existing concept notes that this idea genuinely depends on or connects to. Use the titles exactly as listed; never invent titles here. Empty if none fit.
- "new_prerequisites": short names (2–5 words) for missing fundamentals worth their own concept note, not already in the list.
- "suggested_status": "fuzzy" if there are real errors or big gaps, "getting" if mostly right but vague in places, "clear" only if a 12-year-old would genuinely understand it and it is correct.
- "verdict": one encouraging, honest sentence summarising where they are.

Keep every item to one or two sentences. Empty lists are fine: don't invent problems that aren't there. Use plain British English.`;

function noteText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.innerText || div.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

export interface CritiqueInput {
  title: string;
  source: string | null | undefined;
  /** The concept note's content (their reading notes) — context for the critic. */
  noteHtml: string;
  explanation: string;
  /** Titles of their other concept notes. */
  existingConcepts: string[];
  /** Their previous attempt, if any, so the critique can note progress. */
  previousExplanation?: string;
}

export async function critiqueExplanation(input: CritiqueInput): Promise<{ critique: Critique; model: string }> {
  const notes = noteText(input.noteHtml).slice(0, 12000);
  const prompt = [
    `Concept: ${input.title}`,
    input.source ? `Source they were reading: ${input.source}` : null,
    notes ? `Their reading notes on this concept (for your reference; they did not look at these while explaining):\n<notes>\n${notes}\n</notes>` : null,
    `Their other concept notes (for link_existing):\n${input.existingConcepts.length ? input.existingConcepts.map((t) => `- ${t}`).join('\n') : '(none yet)'}`,
    input.previousExplanation ? `Their previous attempt, for comparison:\n<previous_attempt>\n${input.previousExplanation}\n</previous_attempt>` : null,
    `Their explanation:\n<explanation>\n${input.explanation}\n</explanation>`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const response = await claude().beta.messages.create({
    model: CRITIQUE_MODEL,
    max_tokens: 16000,
    // If a safety classifier declines, Anthropic re-runs it on its recommended fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'high',
      format: { type: 'json_schema', schema: CRITIQUE_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error("Claude declined to critique this explanation. Try rephrasing it.");
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('The critique was cut off. Try a shorter explanation.');
  }
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  let critique: Critique;
  try {
    critique = JSON.parse(text) as Critique;
  } catch {
    throw new Error("Couldn't read Claude's critique. Please try again.");
  }
  // Only keep links to notes that really exist.
  const known = new Map(input.existingConcepts.map((t) => [t.toLowerCase(), t]));
  critique.link_existing = critique.link_existing
    .filter((l) => known.has(l.title.toLowerCase()))
    .map((l) => ({ ...l, title: known.get(l.title.toLowerCase())! }));
  critique.questions = critique.questions.slice(0, 2);
  return { critique, model: response.model };
}
