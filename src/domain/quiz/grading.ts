/**
 * Grading for local quizzes: the app computes correctness and the score
 * itself instead of trusting an AI (plan decision — verifiable correction).
 * Multiple-choice answers arrive as the chosen index serialized as a string
 * ("0".."3"); typed/cloze answers are free text run through typo tolerance.
 */

import type { Exam, ExamStatus, QuizQuestionType } from "../model.js";
import { isAnswerAcceptable } from "./typoTolerance.js";

/** The slice of a question grading needs — the answer key, never the UI VM. */
export interface AnswerKey {
  readonly type: QuizQuestionType;
  /** Correct option index (multiple choice only). */
  readonly correctIndex: number | null;
  /** Expected text (typed/cloze only). */
  readonly correctAnswer: string | null;
  /**
   * The headword behind the question, when the caller knows it. A cloze gap
   * holds an inflected surface form ("walking"), but a learner who answers
   * with the verbete itself ("walk") clearly knows the word — both pass.
   */
  readonly term?: string | null;
}

/**
 * Whether `rawAnswer` is correct for the question. Multiple choice (including
 * AI-enriched questions) compares the chosen index as a string; typed/cloze
 * accept one-typo answers via {@link isAnswerAcceptable}, and cloze also
 * accepts the headword itself when the key carries it. A malformed key
 * (missing index/answer for its type) never grades as correct.
 */
export function gradeAnswer(question: AnswerKey, rawAnswer: string): boolean {
  switch (question.type) {
    case "mc_en_pt":
    case "mc_pt_en":
    case "ai_context":
      return (
        question.correctIndex !== null &&
        rawAnswer.trim() === String(question.correctIndex)
      );
    case "typed":
    case "cloze": {
      if (question.correctAnswer === null) return false;
      if (isAnswerAcceptable(question.correctAnswer, rawAnswer)) return true;
      return (
        question.type === "cloze" &&
        typeof question.term === "string" &&
        isAnswerAcceptable(question.term, rawAnswer)
      );
    }
  }
}

/** Percentage score: round(100 · correct / total); an empty quiz scores 0. */
export function computeScore(results: readonly boolean[]): number {
  if (results.length === 0) return 0;
  const correct = results.filter(Boolean).length;
  return Math.round((100 * correct) / results.length);
}

const QUIZ_STATUSES: readonly ExamStatus[] = ["em_andamento", "finalizada"];

/** Whether an exam belongs to the local quiz flow (vs the legacy copy-paste). */
export function isQuizExam(exam: Pick<Exam, "status">): boolean {
  return QUIZ_STATUSES.includes(exam.status);
}
