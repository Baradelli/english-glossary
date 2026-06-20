/**
 * Repository ports (§5) — the persistence boundary, expressed per aggregate.
 * The domain depends only on these interfaces; the Prisma adapter implements
 * them. Dependencies point inward (hexagonal rule): nothing here imports Prisma
 * or Next. Dates are always supplied by the caller, never read from a clock.
 *
 * Scope is intentionally minimal (YAGNI) — just what persistence, scheduling,
 * the exam transaction and backup need today. Query methods grow per UI flow in
 * later roadmap steps.
 */

import type {
  Exam,
  ExamType,
  ReviewLog,
  Source,
  SourceType,
  Word,
  WordSighting,
} from "../model.js";
import type { ExamResult } from "../exam/examResult.js";

/** SRS fields written back to a Word after a review (computed by the domain). */
export interface SrsUpdate {
  readonly easeFactor: number;
  readonly intervalDays: number;
  readonly repetitions: number;
  readonly nextReview: Date;
}

export interface NewWord {
  readonly term: string;
  readonly definitionEn: string;
  readonly definitionPt: string;
  readonly examples: string[];
  /** Initial due date — a new word is typically due immediately. */
  readonly nextReview: Date;
  readonly createdAt?: Date;
}

export interface NewSighting {
  readonly sourceId: string;
  readonly seenAt: Date;
  readonly contextSentence?: string | null;
  /** True when the word was registered here; false on a re-encounter. */
  readonly isFirstEncounter: boolean;
}

export interface WordRepository {
  create(data: NewWord): Promise<Word>;
  findById(id: string): Promise<Word | null>;
  /** Case-insensitive exact match (never lemmatised). */
  findByTerm(term: string): Promise<Word | null>;
  /** Words whose nextReview is at or before `now`, oldest due first. */
  listDueForReview(now: Date): Promise<Word[]>;
  updateSrs(id: string, srs: SrsUpdate): Promise<Word>;
  recordSighting(wordId: string, sighting: NewSighting): Promise<WordSighting>;
}

export interface NewSource {
  readonly name: string;
  readonly url?: string | null;
  readonly sourceTypeId: string;
  readonly createdAt?: Date;
}

export interface SourceRepository {
  create(data: NewSource): Promise<Source>;
  findById(id: string): Promise<Source | null>;
  findByUrl(url: string): Promise<Source | null>;
  list(): Promise<Source[]>;
}

export interface SourceTypeRepository {
  /** Creates a type; rejects a case-insensitive duplicate name. */
  create(name: string): Promise<SourceType>;
  findByName(name: string): Promise<SourceType | null>;
  list(): Promise<SourceType[]>;
}

export interface NewReviewLog {
  readonly wordId: string;
  readonly quality: number;
  readonly reviewedAt: Date;
  readonly intervalDays: number;
}

export interface ReviewLogRepository {
  create(data: NewReviewLog): Promise<ReviewLog>;
  listByWord(wordId: string): Promise<ReviewLog[]>;
}

export interface NewExam {
  readonly type: ExamType;
  readonly sourceId?: string | null;
  readonly promptText: string;
  readonly createdAt?: Date;
}

/** One affected word inside an exam correction. */
export interface WordCorrection {
  readonly wordId: string;
  readonly correct: boolean;
  /** New SRS state for this word (computed by the domain from quality). */
  readonly srs: SrsUpdate;
  /** Review-log entry to record alongside the SRS write. */
  readonly reviewLog: { readonly quality: number; readonly reviewedAt: Date };
}

/**
 * Everything written when an exam transitions to `corrigida` (§5, §6.2). The
 * caller computes this from the validated {@link ExamResult}; the repository
 * persists it atomically.
 */
export interface ExamCorrection {
  readonly resultJson: ExamResult;
  readonly score: number;
  readonly words: readonly WordCorrection[];
}

export interface ExamRepository {
  create(data: NewExam): Promise<Exam>;
  findById(id: string): Promise<Exam | null>;
  /**
   * Persists a correction in a single transaction: marks the exam `corrigida`,
   * stores the result JSON + score, writes one ExamWord per word, and updates
   * each affected word's SRS plus its ReviewLog. All-or-nothing.
   */
  submitCorrection(examId: string, correction: ExamCorrection): Promise<Exam>;
}
