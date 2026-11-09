import type Anthropic from '@anthropic-ai/sdk';
import { claude } from './claude';
import type { Critique } from './explainBack';

/** Model for drafting flashcards (Phase 4). */
export const FLASHCARD_MODEL = 'claude-haiku-5-5';

export interface DraftCard {
  question: string;
  answer: string;
}

const SCHEMA = {
  type: 'object',
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: { question: { type: 'string' }, answer: { type: 'string' } },
        required: ['question', 'answer'],
        additionalProperties: false,
      },
    },
  },
  required: ['cards'],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You write flashcards for active recall, from the learner's OWN explanation of a concept (written Feynman-style, as if teaching a 12-year-old).

Rules:
- Write 3 to 5 cards. Base them on the ideas in their explanation, not on generic facts about the topic.
- Strongly favour "why" and "how" questions (mechanisms, causes, consequences, contrasts) over definitions or trivia. At most one "what is" card.
- Each question must make sense on its own, weeks later, without seeing the note. Name the concept in the question.
- Answers: 1–3 short sentences in plain language, the way the learner would say it. Use their framing and examples where they're right.
- If a critique flagged something in their explanation as wrong, never put the mistake in an answer: use the correct idea, or skip that point.
- No cloze deletions, no yes/no questions, no multiple choice.
- Plain British English.`;

export async function draftFlashcards(input: {
  title: string;
  explanation: string;
  critique?: Critique | null;
}): Promise<DraftCard[]> {
  const corrections = input.critique?.wrong?.length
    ? `\n\nThe critique flagged these as wrong (don't teach the mistakes):\n${input.critique.wrong.map((w) => `- "${w.quote}": ${w.issue}`).join('\n')}`
    : '';

  const response = await claude().messages.create({
    model: FLASHCARD_MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [
      {
        role: 'user',
        content: `Concept: ${input.title}\n\nMy explanation:\n<explanation>\n${input.explanation}\n</explanation>${corrections}`,
      },
    ],
  });

  if (response.stop_reason === 'refusal') throw new Error('Claude declined to write cards for this. Try editing your explanation.');
  if (response.stop_reason === 'max_tokens') throw new Error('The cards were cut off. Please try again.');
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  let parsed: { cards: DraftCard[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Couldn't read the drafted cards. Please try again.");
  }
  return parsed.cards
    .map((c) => ({ question: c.question.trim(), answer: c.answer.trim() }))
    .filter((c) => c.question && c.answer)
    .slice(0, 5);
}
