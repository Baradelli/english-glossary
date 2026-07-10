/**
 * Pure domain entities (§6). These are plain data the rest of the app speaks;
 * the persistence adapter maps database rows to and from these shapes. No
 * Prisma, no I/O types leak in here. The word's state is derived (§6.1), never
 * stored — see {@link deriveWordState}.
 */

import type { ExamResult } from "./exam/examResult.js";

export type ExamType = "semanal" | "vocabulario" | "compreensao" | "pratica";
/**
 * Local quizzes move `em_andamento` → `finalizada`; the legacy/comprehension
 * copy-paste flow keeps `gerada` → `respondida` → `corrigida`. The status
 * alone discriminates the two flows — no extra column.
 */
export type ExamStatus =
  | "gerada"
  | "respondida"
  | "corrigida"
  | "em_andamento"
  | "finalizada";

/**
 * Question kinds. New quizzes are AI-generated multiple choice (`ai_context`,
 * ADR-009); the other values remain so exams created by the retired local
 * generator (ADR-007) keep rendering and grading. Declared here because
 * {@link ExamQuestion} owns the field.
 */
export type QuizQuestionType =
  | "mc_en_pt"
  | "mc_pt_en"
  | "typed"
  | "cloze"
  | "ai_context";

/** Discriminates a plain dictionary word from a fixed expression/idiom (ADR-005). */
export type WordKind = "palavra" | "expressao";

export interface Word {
  readonly id: string;
  readonly term: string;
  /** Whether this entry is a single word or a fixed expression. */
  readonly kind: WordKind;
  readonly definitionEn: string;
  readonly definitionPt: string;
  readonly examples: string[];
  readonly easeFactor: number;
  readonly intervalDays: number;
  readonly repetitions: number;
  readonly nextReview: Date;
  readonly createdAt: Date;
}

export interface SourceType {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;
}

export interface Source {
  readonly id: string;
  readonly name: string;
  readonly url: string | null;
  readonly sourceTypeId: string;
  readonly createdAt: Date;
}

export interface WordSighting {
  readonly id: string;
  readonly wordId: string;
  readonly sourceId: string;
  readonly seenAt: Date;
  readonly contextSentence: string | null;
  readonly isFirstEncounter: boolean;
  /** Optional per-source meaning, separate from the word's general definition. */
  readonly definitionEn: string | null;
  readonly definitionPt: string | null;
  /** Examples specific to this source. */
  readonly examples: string[];
}

export interface ReviewLog {
  readonly id: string;
  readonly wordId: string;
  readonly quality: number;
  readonly reviewedAt: Date;
  readonly intervalDays: number;
}

export interface Exam {
  readonly id: string;
  readonly type: ExamType;
  readonly sourceId: string | null;
  readonly status: ExamStatus;
  readonly promptText: string;
  readonly answersText: string | null;
  readonly correctionPrompt: string | null;
  readonly resultJson: ExamResult | null;
  readonly score: number | null;
  /** When a quiz was closed (quiz flow only; legacy exams keep null). */
  readonly finishedAt: Date | null;
  /** Origin exam of a practice quiz; null unless `type` is "pratica" (or the origin was deleted). */
  readonly practiceOfId: string | null;
  readonly createdAt: Date;
}

/** One answerable unit of a local quiz, always anchored to a Word. */
export interface ExamQuestion {
  readonly id: string;
  readonly examId: string;
  readonly wordId: string;
  readonly position: number;
  readonly type: QuizQuestionType;
  readonly prompt: string;
  /** Multiple-choice alternatives; null for typed/cloze questions. */
  readonly options: string[] | null;
  /** Index into `options` (multiple choice only). */
  readonly correctIndex: number | null;
  /** Expected text (typed/cloze only). */
  readonly correctAnswer: string | null;
  /** The source sentence backing a cloze/AI question. */
  readonly contextSentence: string | null;
  /** Short PT explanation of the correct answer, shown after answering (AI questions). */
  readonly explanation: string | null;
  readonly userAnswer: string | null;
  readonly isCorrect: boolean | null;
  readonly answeredAt: Date | null;
}

export interface ExamWord {
  readonly id: string;
  readonly examId: string;
  readonly wordId: string;
  readonly correct: boolean;
}
