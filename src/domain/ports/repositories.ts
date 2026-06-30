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
  WordKind,
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
  /** Defaults to "palavra" at the persistence boundary when omitted. */
  readonly kind?: WordKind;
  readonly definitionEn: string;
  readonly definitionPt: string;
  readonly examples: string[];
  /** Initial due date — a new word is typically due immediately. */
  readonly nextReview: Date;
  readonly createdAt?: Date;
}

/** Editable fields of a word (its general definition; term and SRS untouched). */
export interface UpdateWord {
  readonly definitionEn: string;
  readonly definitionPt: string;
  readonly examples: string[];
}

/** A sighting to record against an already-existing word. */
export interface NewSighting {
  readonly wordId: string;
  readonly sourceId: string;
  readonly seenAt: Date;
  readonly contextSentence?: string | null;
  /** True when the word was registered here; false on a re-encounter. */
  readonly isFirstEncounter: boolean;
}

/** The first sighting created together with a brand-new word. */
export interface FirstSighting {
  readonly sourceId: string;
  readonly seenAt: Date;
  readonly contextSentence?: string | null;
}

export interface ApplyReviewInput {
  readonly wordId: string;
  readonly srs: SrsUpdate;
  readonly reviewLog: { readonly quality: number; readonly reviewedAt: Date };
}

export interface WordRepository {
  create(data: NewWord): Promise<Word>;
  /**
   * Creates a new word and its first sighting (isFirstEncounter=true) in one
   * transaction — the capture flow's atomic unit.
   */
  createWithFirstSighting(
    word: NewWord,
    sighting: FirstSighting,
  ): Promise<{ word: Word; sighting: WordSighting }>;
  findById(id: string): Promise<Word | null>;
  /** Case-insensitive exact match (never lemmatised). */
  findByTerm(term: string): Promise<Word | null>;
  /** Every word, for the glossary list. */
  listAll(): Promise<Word[]>;
  /** Edits a word's general definition/examples (not its term or SRS state). */
  update(id: string, data: UpdateWord): Promise<Word>;
  /** Words whose nextReview is at or before `now`, oldest due first. */
  listDueForReview(now: Date): Promise<Word[]>;
  updateSrs(id: string, srs: SrsUpdate): Promise<Word>;
  /**
   * Applies a review in one transaction: writes the new SRS state to the word
   * and records the ReviewLog entry. Used by the review flow (§ Fluxo B).
   */
  applyReview(input: ApplyReviewInput): Promise<Word>;
}

/** Editable per-source fields of a sighting. */
export interface UpdateSighting {
  readonly contextSentence?: string | null;
  readonly definitionEn?: string | null;
  readonly definitionPt?: string | null;
  readonly examples?: string[];
}

export interface WordSightingRepository {
  /** Records a sighting against an existing word (e.g. a re-encounter). */
  record(data: NewSighting): Promise<WordSighting>;
  findById(id: string): Promise<WordSighting | null>;
  update(id: string, data: UpdateSighting): Promise<WordSighting>;
  listByWord(wordId: string): Promise<WordSighting[]>;
  listBySource(sourceId: string): Promise<WordSighting[]>;
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
  listByType(sourceTypeId: string): Promise<Source[]>;
  /**
   * Deletes a source. Its sightings cascade away and exams that referenced it
   * keep their data with sourceId nulled — words are never deleted.
   */
  delete(id: string): Promise<void>;
}

export interface SourceTypeRepository {
  /** Creates a type; rejects a case-insensitive duplicate name. */
  create(name: string): Promise<SourceType>;
  findById(id: string): Promise<SourceType | null>;
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
  /** Number of reviews recorded at or after `date` (for the dashboard). */
  countSince(date: Date): Promise<number>;
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
  /** Every exam, newest first, for the exams list. */
  listAll(): Promise<Exam[]>;
  /**
   * Stores the pasted exam-and-answers plus the generated correction prompt and
   * moves the exam to `respondida` (the second turn of the two-turn flow).
   */
  saveAnswers(
    examId: string,
    data: { readonly answersText: string; readonly correctionPrompt: string },
  ): Promise<Exam>;
  /**
   * Persists a correction in a single transaction: marks the exam `corrigida`,
   * stores the result JSON + score, writes one ExamWord per word, and updates
   * each affected word's SRS plus its ReviewLog. All-or-nothing.
   */
  submitCorrection(examId: string, correction: ExamCorrection): Promise<Exam>;
}
