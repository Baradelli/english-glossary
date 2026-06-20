/**
 * Pure domain entities (§6). These are plain data the rest of the app speaks;
 * the persistence adapter maps database rows to and from these shapes. No
 * Prisma, no I/O types leak in here. The word's state is derived (§6.1), never
 * stored — see {@link deriveWordState}.
 */

import type { ExamResult } from "./exam/examResult.js";

export type ExamType = "semanal" | "vocabulario" | "compreensao";
export type ExamStatus = "gerada" | "respondida" | "corrigida";

export interface Word {
  readonly id: string;
  readonly term: string;
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
  readonly createdAt: Date;
}

export interface ExamWord {
  readonly id: string;
  readonly examId: string;
  readonly wordId: string;
  readonly correct: boolean;
}
