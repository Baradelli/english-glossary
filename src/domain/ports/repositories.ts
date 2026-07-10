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
  ExamQuestion,
  ExamType,
  ExamWord,
  QuizQuestionType,
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
  /** Appends student context without replacing definitions or earlier observations. */
  appendObservation(id: string, observation: string): Promise<Word>;
  updateSrs(id: string, srs: SrsUpdate): Promise<Word>;
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
  /**
   * Every sighting with seenAt at or after `date`, oldest first — the
   * dashboard's activity window.
   */
  listSince(date: Date): Promise<WordSighting[]>;
  /**
   * Every sighting's seenAt instant, oldest first — dates only, unbounded.
   * Feeds the study streak, which may reach further back than any window.
   */
  listSeenDates(): Promise<Date[]>;
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
  /**
   * Every log with reviewedAt at or after `date`, oldest first — the
   * dashboard's activity window.
   */
  listSince(date: Date): Promise<ReviewLog[]>;
  /**
   * Every log's reviewedAt instant, oldest first — dates only, unbounded.
   * Feeds the study streak, which may reach further back than any window.
   */
  listReviewDates(): Promise<Date[]>;
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

/** One question of a quiz, as validated from the AI reply (pre-persistence). */
export interface NewExamQuestion {
  readonly wordId: string;
  readonly position: number;
  readonly type: QuizQuestionType;
  readonly prompt: string;
  /** Multiple-choice alternatives; null for legacy typed/cloze questions. */
  readonly options: readonly string[] | null;
  /** Index into `options` (multiple choice only). */
  readonly correctIndex: number | null;
  /** Expected text (legacy typed/cloze only). */
  readonly correctAnswer: string | null;
  /** The source sentence backing the question. */
  readonly contextSentence: string | null;
  /** Short PT explanation of the correct answer, shown after answering. */
  readonly explanation: string | null;
  /** Per-option PT explanations aligned with options; null for legacy questions. */
  readonly optionExplanations: readonly string[] | null;
}

/** A local quiz to open: the exam shell plus every generated question. */
export interface NewQuizExam {
  readonly type: ExamType;
  /** Origin exam when this is a practice quiz re-testing its mistakes. */
  readonly practiceOfId?: string | null;
  readonly questions: readonly NewExamQuestion[];
  readonly createdAt?: Date;
}

/** The graded answer written onto a question (computed server-side). */
export interface QuestionAnswer {
  readonly userAnswer: string;
  readonly isCorrect: boolean;
  readonly answeredAt: Date;
}

/**
 * Everything written when a quiz transitions to `finalizada`. The caller
 * computes the score and per-word SRS effects (mirror of {@link
 * ExamCorrection}); the repository persists them atomically.
 */
export interface FinishQuizData {
  readonly score: number;
  readonly finishedAt: Date;
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
  /**
   * Opens a local quiz in one transaction: creates the exam in `em_andamento`
   * together with every question. All-or-nothing — a quiz never exists
   * half-built.
   */
  createQuiz(data: NewQuizExam): Promise<Exam>;
  /** Every question of an exam, ordered by position. */
  listQuestions(examId: string): Promise<ExamQuestion[]>;
  findQuestionById(id: string): Promise<ExamQuestion | null>;
  /**
   * Writes the graded answer onto a question, only if it is still unanswered
   * (answeredAt null) — a second submission is rejected, keeping answers
   * idempotent across double-clicks and stale tabs.
   */
  answerQuestion(questionId: string, data: QuestionAnswer): Promise<ExamQuestion>;
  /**
   * The open quiz of the given type, if any — the start flow resumes it
   * instead of creating a duplicate.
   */
  findInProgressByType(type: ExamType): Promise<Exam | null>;
  /**
   * Closes a quiz in a single all-or-nothing transaction: requires the exam to
   * still be `em_andamento` (guards against a double close), stores score +
   * finishedAt + status `finalizada`, writes one ExamWord per word, and
   * updates each word's SRS plus its ReviewLog (mirror of {@link
   * submitCorrection}).
   */
  finishQuiz(examId: string, data: FinishQuizData): Promise<Exam>;
  /**
   * Every ExamWord row across all exams — the per-word hit/miss facts behind
   * the dashboard's difficult-words ranking.
   */
  listWordResults(): Promise<ExamWord[]>;
}

/** Key-value app settings (AI provider config, theme, onboarding flags, ...). */
export interface SettingsRepository {
  get(key: string): Promise<string | null>;
  getMany(keys: readonly string[]): Promise<Record<string, string>>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}
