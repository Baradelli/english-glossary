/**
 * Mappers between Prisma rows and pure domain models. They strip persistence
 * details (e.g. the normalized `termKey`/`nameKey` columns) and decode the
 * JSON-encoded string columns SQLite forces on us (Word.examples,
 * Exam.resultJson). Domain code never sees a Prisma type.
 */

import type {
  Exam as PrismaExam,
  ExamQuestion as PrismaExamQuestion,
  ExamWord as PrismaExamWord,
  ReviewLog as PrismaReviewLog,
  Source as PrismaSource,
  SourceType as PrismaSourceType,
  Word as PrismaWord,
  WordSighting as PrismaWordSighting,
} from "@prisma/client";
import type {
  Exam,
  ExamQuestion,
  ExamStatus,
  ExamType,
  ExamWord,
  QuizQuestionType,
  ReviewLog,
  Source,
  SourceType,
  Word,
  WordKind,
  WordSighting,
} from "../../domain/model.js";
import {
  ExamResultSchema,
  type ExamResult,
} from "../../domain/exam/examResult.js";

export function toSourceType(row: PrismaSourceType): SourceType {
  return { id: row.id, name: row.name, createdAt: row.createdAt };
}

export function toSource(row: PrismaSource): Source {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    sourceTypeId: row.sourceTypeId,
    createdAt: row.createdAt,
  };
}

function decodeStringArray(raw: string, column: string): string[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.some((s) => typeof s !== "string")) {
    throw new Error(`${column} is not a JSON array of strings`);
  }
  return parsed as string[];
}

function decodeExamples(raw: string): string[] {
  return decodeStringArray(raw, "Word.examples");
}

export function toWord(row: PrismaWord): Word {
  return {
    id: row.id,
    term: row.term,
    kind: row.kind as WordKind,
    definitionEn: row.definitionEn,
    definitionPt: row.definitionPt,
    examples: decodeExamples(row.examples),
    easeFactor: row.easeFactor,
    intervalDays: row.intervalDays,
    repetitions: row.repetitions,
    nextReview: row.nextReview,
    createdAt: row.createdAt,
  };
}

export function toWordSighting(row: PrismaWordSighting): WordSighting {
  return {
    id: row.id,
    wordId: row.wordId,
    sourceId: row.sourceId,
    seenAt: row.seenAt,
    contextSentence: row.contextSentence,
    isFirstEncounter: row.isFirstEncounter,
    definitionEn: row.definitionEn,
    definitionPt: row.definitionPt,
    examples: row.examples === null ? [] : decodeExamples(row.examples),
  };
}

export function toReviewLog(row: PrismaReviewLog): ReviewLog {
  return {
    id: row.id,
    wordId: row.wordId,
    quality: row.quality,
    reviewedAt: row.reviewedAt,
    intervalDays: row.intervalDays,
  };
}

function decodeResultJson(raw: string | null): ExamResult | null {
  if (raw === null) return null;
  return ExamResultSchema.parse(JSON.parse(raw));
}

export function toExamQuestion(row: PrismaExamQuestion): ExamQuestion {
  return {
    id: row.id,
    examId: row.examId,
    wordId: row.wordId,
    position: row.position,
    type: row.type as QuizQuestionType,
    prompt: row.prompt,
    options:
      row.options === null
        ? null
        : decodeStringArray(row.options, "ExamQuestion.options"),
    correctIndex: row.correctIndex,
    correctAnswer: row.correctAnswer,
    contextSentence: row.contextSentence,
    explanation: row.explanation,
    userAnswer: row.userAnswer,
    isCorrect: row.isCorrect,
    answeredAt: row.answeredAt,
  };
}

export function toExamWord(row: PrismaExamWord): ExamWord {
  return {
    id: row.id,
    examId: row.examId,
    wordId: row.wordId,
    correct: row.correct,
  };
}

export function toExam(row: PrismaExam): Exam {
  return {
    id: row.id,
    type: row.type as ExamType,
    sourceId: row.sourceId,
    status: row.status as ExamStatus,
    promptText: row.promptText,
    answersText: row.answersText,
    correctionPrompt: row.correctionPrompt,
    resultJson: decodeResultJson(row.resultJson),
    score: row.score,
    finishedAt: row.finishedAt,
    practiceOfId: row.practiceOfId,
    createdAt: row.createdAt,
  };
}

