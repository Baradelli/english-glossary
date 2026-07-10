/**
 * Application-layer DTOs: inputs and read-model (view) shapes for the capture
 * flow (Fluxo A). View-models are assembled by use cases from domain entities;
 * the UI consumes these and never touches repositories directly.
 */

import type {
  ActivityCalendar,
  ReviewForecast,
  ScorePoint,
  Source,
  SourceType,
  VocabGrowth,
  Word,
  WordKind,
  WordSighting,
  WordState,
} from "../domain/index.js";

export interface RegisterNewWordInput {
  readonly term: string;
  /** "palavra" (default) or "expressao" — see ADR-005. */
  readonly kind?: WordKind;
  readonly definitionEn: string;
  readonly definitionPt: string;
  readonly examples: string[];
  readonly sourceId: string;
  readonly contextSentence?: string | null;
}

export interface RecordReencounterInput {
  readonly wordId: string;
  readonly sourceId: string;
  readonly contextSentence?: string | null;
}

/**
 * Capturing a word while on a source page (batch capture). Definition fields
 * are only required when the term is new; on a re-encounter they're ignored.
 */
export interface CaptureInSourceInput {
  readonly sourceId: string;
  readonly term: string;
  /** "palavra" (default) or "expressao" — only used when the term is new. */
  readonly kind?: WordKind;
  readonly definitionEn?: string;
  readonly definitionPt?: string;
  readonly examples?: string[];
  readonly contextSentence?: string | null;
}

export interface EnsureSourceInput {
  readonly name: string;
  readonly url?: string | null;
  readonly sourceTypeId: string;
}

/** One source where a word was seen, for the per-word view. */
export interface WordSightingView {
  readonly sightingId: string;
  readonly sourceId: string;
  readonly sourceName: string;
  readonly seenAt: Date;
  readonly contextSentence: string | null;
  readonly isFirstEncounter: boolean;
  /** Whether this sighting has its own per-source meaning recorded. */
  readonly hasOwnDefinition: boolean;
}

export interface WordDetail {
  readonly word: Word;
  readonly state: WordState;
  readonly sightings: WordSightingView[];
}

/** One word learned in a source, for the per-source view. */
export interface SourceWordView {
  readonly sightingId: string;
  readonly word: Word;
  readonly seenAt: Date;
  readonly contextSentence: string | null;
}

/** A single sighting (a word seen in a source) with its word and source. */
export interface SightingDetail {
  readonly sighting: WordSighting;
  readonly word: Word | null;
  readonly source: Source | null;
}

export interface EditWordInput {
  readonly definitionEn: string;
  readonly definitionPt: string;
  readonly examples: string[];
}

export interface AddWordObservationInput {
  readonly wordId: string;
  readonly text: string;
}

export interface EditSightingInput {
  readonly contextSentence?: string | null;
  readonly definitionEn?: string | null;
  readonly definitionPt?: string | null;
  readonly examples?: string[];
}

/**
 * Scalar totals shown on the dashboard's quiet footer. `exams.corrected`
 * counts every CONCLUDED exam — legacy `corrigida` and quiz `finalizada` —
 * with a non-null score, and `averageScore` averages over that same set (the
 * UI labels it "concluídas").
 */
export interface DashboardMetrics {
  readonly words: {
    readonly total: number;
    readonly nova: number;
    readonly aprendendo: number;
    readonly dominada: number;
  };
  readonly sources: number;
  readonly reviewsLast7Days: number;
  readonly exams: {
    readonly total: number;
    readonly corrected: number;
    readonly averageScore: number | null;
  };
}

/** One entry of the "palavras difíceis" ranking, term/kind already resolved. */
export interface DifficultWordView {
  readonly wordId: string;
  readonly term: string;
  readonly kind: WordKind;
  /** All-time exam misses — displayed as context, never added to the count. */
  readonly examErrors: number;
  /** Failed reviews (quality < 3) in the activity window — the ranking key. */
  readonly failedReviews: number;
}

/**
 * Everything the "Painel" home renders, assembled in one use case so the page
 * makes a single call. Time-based sections speak in LOCAL days — `now` and
 * the timezone offset are injected by the page (see domain/insights).
 */
export interface DashboardData {
  /** The "hoje" strip: streak + today's due/done/captured counts. */
  readonly today: {
    readonly streakDays: number;
    /**
     * Reviews due at or before `now` — words already due for study
     * (mirror of `forecast.dueNowCount`).
     */
    readonly dueNowCount: number;
    /**
     * Reviews due later today, after `now` — not answerable yet (mirror of
     * `forecast.dueLaterTodayCount`).
     */
    readonly dueLaterTodayCount: number;
    readonly reviewedTodayCount: number;
    readonly capturedTodayCount: number;
  };
  readonly activity: ActivityCalendar;
  readonly forecast: ReviewForecast;
  readonly growth: VocabGrowth;
  /** Current per-state composition (derived, never stored — §6.1). */
  readonly composition: {
    readonly nova: number;
    readonly aprendendo: number;
    readonly dominada: number;
  };
  readonly scoreTrend: ScorePoint[];
  readonly difficultWords: DifficultWordView[];
  readonly totals: DashboardMetrics;
}

export interface SourceDetail {
  readonly source: Source;
  readonly sourceType: SourceType | null;
  /** Words registered in this source (isFirstEncounter=true). */
  readonly newWords: SourceWordView[];
  /** Words already known, re-encountered here (isFirstEncounter=false). */
  readonly reencounters: SourceWordView[];
  readonly totalWords: number;
}
