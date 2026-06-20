/**
 * Application-layer DTOs: inputs and read-model (view) shapes for the capture
 * flow (Fluxo A). View-models are assembled by use cases from domain entities;
 * the UI consumes these and never touches repositories directly.
 */

import type { Source, SourceType, Word, WordState } from "../domain/index.js";

export interface RegisterNewWordInput {
  readonly term: string;
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
  readonly sourceId: string;
  readonly sourceName: string;
  readonly seenAt: Date;
  readonly contextSentence: string | null;
  readonly isFirstEncounter: boolean;
}

export interface WordDetail {
  readonly word: Word;
  readonly state: WordState;
  readonly sightings: WordSightingView[];
}

/** One word learned in a source, for the per-source view. */
export interface SourceWordView {
  readonly word: Word;
  readonly seenAt: Date;
  readonly contextSentence: string | null;
}

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

export interface SourceDetail {
  readonly source: Source;
  readonly sourceType: SourceType | null;
  /** Words registered in this source (isFirstEncounter=true). */
  readonly newWords: SourceWordView[];
  /** Words already known, re-encountered here (isFirstEncounter=false). */
  readonly reencounters: SourceWordView[];
  readonly totalWords: number;
}
