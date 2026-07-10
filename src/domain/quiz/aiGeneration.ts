/**
 * AI quiz assembly (ADR-009). The AI writes every question — the app only
 * decides WHICH words enter the quiz (wordSelection), validates the reply
 * (aiQuiz) and, here, turns validated items into persistable questions:
 * matching each item back to its word, rejecting anything dishonest (duplicate
 * or empty alternatives), reshuffling the options with the injected seed so
 * the correct answer never sits where the AI happened to put it, and
 * numbering positions. Pure: no I/O, no clock, no Math.random.
 */

import type { QuizQuestionType, WordKind } from "../model.js";
import type { AiQuizItem } from "./aiQuiz.js";
import { createRng, shuffle } from "./rng.js";

/** What the quiz flow needs to know about each word entering the quiz. */
export interface QuizWordInput {
  readonly id: string;
  readonly term: string;
  readonly kind: WordKind;
  readonly definitionEn: string;
  readonly definitionPt: string;
  /** Student-added context that can inform future questions. */
  readonly observations: readonly string[];
  /** Real sentences from sources (WordSighting) — grounds the AI questions. */
  readonly contextSentences: readonly string[];
}

/** A validated question, ready to be persisted as an ExamQuestion. */
export interface QuizQuestion {
  readonly wordId: string;
  readonly position: number;
  readonly type: QuizQuestionType;
  readonly prompt: string;
  /** The four multiple-choice alternatives. */
  readonly options: string[] | null;
  /** Explanations paired with the alternatives after reshuffling. */
  readonly optionExplanations: string[] | null;
  /** Index of the correct alternative. */
  readonly correctIndex: number | null;
  /** Expected text — always null for multiple choice. */
  readonly correctAnswer: string | null;
  /** The source sentence backing the question, when the word has one. */
  readonly contextSentence: string | null;
  /** Short PT explanation of the correct answer, shown after answering. */
  readonly explanation: string | null;
}

export interface BuildAiQuizInput {
  /** Items already validated against the AiQuiz schema. */
  readonly items: readonly AiQuizItem[];
  /** The words sent to the AI — the only valid anchors for questions. */
  readonly words: readonly QuizWordInput[];
  readonly seed: number;
}

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase();
}

function normalizeOption(option: string): string {
  return option.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * An item is honest when all four alternatives are non-empty and distinct
 * (case/whitespace-insensitive) — otherwise "pick the right one" is either
 * ambiguous or trivially solvable, and the item is dropped.
 */
function hasHonestOptions(item: AiQuizItem): boolean {
  const seen = new Set<string>();
  for (const option of item.options) {
    const normalized = normalizeOption(option);
    if (normalized.length === 0 || seen.has(normalized)) return false;
    seen.add(normalized);
  }
  return true;
}

/**
 * Builds the persistable questions from a validated AI reply. An item only
 * becomes a question when its `term` matches one of the quiz words (first
 * item wins — at most one question per word, preserving the ExamQuestion
 * uniqueness invariant) and its options pass {@link hasHonestOptions};
 * everything else is silently dropped, so a partially usable reply still
 * yields a playable quiz. Question order and each question's options are
 * reshuffled with the seeded rng, and positions are renumbered 0..n-1.
 */
export function buildAiQuizQuestions(input: BuildAiQuizInput): QuizQuestion[] {
  const rng = createRng(input.seed);
  const wordByTerm = new Map(input.words.map((w) => [normalizeTerm(w.term), w]));

  const drafts: Omit<QuizQuestion, "position">[] = [];
  const used = new Set<string>();
  for (const item of input.items) {
    const word = wordByTerm.get(normalizeTerm(item.term));
    if (!word || used.has(word.id)) continue;
    if (!hasHonestOptions(item)) continue;
    const pairs = item.options.map((option, index) => ({
      option,
      explanation: item.optionExplanations[index] ?? "",
    }));
    const correct = pairs[item.correctIndex];
    if (correct === undefined) continue;

    used.add(word.id);
    const shuffled = shuffle(pairs, rng);
    drafts.push({
      wordId: word.id,
      type: "ai_context",
      prompt: item.prompt,
      options: shuffled.map((pair) => pair.option),
      optionExplanations: shuffled.map((pair) => pair.explanation),
      correctIndex: shuffled.indexOf(correct),
      correctAnswer: null,
      contextSentence: word.contextSentences[0] ?? null,
      explanation: correct.explanation,
    });
  }

  return shuffle(drafts, rng).map((draft, index) => ({
    ...draft,
    position: index,
  }));
}
