/**
 * Full-database export/import (§2, §4). The SQLite file is the canonical store,
 * but a versioned JSON dump is a first-class backup: human-readable, diffable,
 * and round-trippable into an empty database.
 *
 * Dates are ISO strings and the JSON-encoded columns (Word.examples,
 * Exam.resultJson) are decoded into rich JSON, so the backup file is clean
 * rather than double-encoded. Import validates the file against {@link
 * BackupSchema} and writes everything in one transaction, recomputing the
 * normalized key columns.
 */

import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { ExamResultSchema } from "../../domain/exam/examResult.js";

const Iso = z.string().datetime();

const SourceTypeBackup = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: Iso,
});
const SourceBackup = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().nullable(),
  sourceTypeId: z.string(),
  createdAt: Iso,
});
const WordBackup = z.object({
  id: z.string(),
  term: z.string(),
  definitionEn: z.string(),
  definitionPt: z.string(),
  examples: z.array(z.string()),
  easeFactor: z.number(),
  intervalDays: z.number().int(),
  repetitions: z.number().int(),
  nextReview: Iso,
  createdAt: Iso,
});
const WordSightingBackup = z.object({
  id: z.string(),
  wordId: z.string(),
  sourceId: z.string(),
  seenAt: Iso,
  contextSentence: z.string().nullable(),
  isFirstEncounter: z.boolean(),
});
const ReviewLogBackup = z.object({
  id: z.string(),
  wordId: z.string(),
  quality: z.number().int(),
  reviewedAt: Iso,
  intervalDays: z.number().int(),
});
const ExamBackup = z.object({
  id: z.string(),
  type: z.string(),
  sourceId: z.string().nullable(),
  status: z.string(),
  promptText: z.string(),
  answersText: z.string().nullable(),
  correctionPrompt: z.string().nullable(),
  resultJson: ExamResultSchema.nullable(),
  score: z.number().int().nullable(),
  createdAt: Iso,
});
const ExamWordBackup = z.object({
  id: z.string(),
  examId: z.string(),
  wordId: z.string(),
  correct: z.boolean(),
});

export const BackupSchema = z.object({
  version: z.literal(1),
  sourceTypes: z.array(SourceTypeBackup),
  sources: z.array(SourceBackup),
  words: z.array(WordBackup),
  wordSightings: z.array(WordSightingBackup),
  reviewLogs: z.array(ReviewLogBackup),
  exams: z.array(ExamBackup),
  examWords: z.array(ExamWordBackup),
});

export type Backup = z.infer<typeof BackupSchema>;

export async function exportAll(prisma: PrismaClient): Promise<Backup> {
  const [sourceTypes, sources, words, wordSightings, reviewLogs, exams, examWords] =
    await Promise.all([
      prisma.sourceType.findMany(),
      prisma.source.findMany(),
      prisma.word.findMany(),
      prisma.wordSighting.findMany(),
      prisma.reviewLog.findMany(),
      prisma.exam.findMany(),
      prisma.examWord.findMany(),
    ]);

  return {
    version: 1,
    sourceTypes: sourceTypes.map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt.toISOString(),
    })),
    sources: sources.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      sourceTypeId: r.sourceTypeId,
      createdAt: r.createdAt.toISOString(),
    })),
    words: words.map((r) => ({
      id: r.id,
      term: r.term,
      definitionEn: r.definitionEn,
      definitionPt: r.definitionPt,
      examples: z.array(z.string()).parse(JSON.parse(r.examples)),
      easeFactor: r.easeFactor,
      intervalDays: r.intervalDays,
      repetitions: r.repetitions,
      nextReview: r.nextReview.toISOString(),
      createdAt: r.createdAt.toISOString(),
    })),
    wordSightings: wordSightings.map((r) => ({
      id: r.id,
      wordId: r.wordId,
      sourceId: r.sourceId,
      seenAt: r.seenAt.toISOString(),
      contextSentence: r.contextSentence,
      isFirstEncounter: r.isFirstEncounter,
    })),
    reviewLogs: reviewLogs.map((r) => ({
      id: r.id,
      wordId: r.wordId,
      quality: r.quality,
      reviewedAt: r.reviewedAt.toISOString(),
      intervalDays: r.intervalDays,
    })),
    exams: exams.map((r) => ({
      id: r.id,
      type: r.type,
      sourceId: r.sourceId,
      status: r.status,
      promptText: r.promptText,
      answersText: r.answersText,
      correctionPrompt: r.correctionPrompt,
      resultJson: r.resultJson
        ? ExamResultSchema.parse(JSON.parse(r.resultJson))
        : null,
      score: r.score,
      createdAt: r.createdAt.toISOString(),
    })),
    examWords: examWords.map((r) => ({
      id: r.id,
      examId: r.examId,
      wordId: r.wordId,
      correct: r.correct,
    })),
  };
}

/**
 * Imports a backup into an (expected empty) database. Validates first, then
 * writes in FK-safe order inside a single transaction — all or nothing.
 */
export async function importAll(
  prisma: PrismaClient,
  data: unknown,
): Promise<void> {
  const backup = BackupSchema.parse(data);

  await prisma.$transaction(async (tx) => {
    for (const t of backup.sourceTypes) {
      await tx.sourceType.create({
        data: {
          id: t.id,
          name: t.name,
          nameKey: t.name.toLowerCase(),
          createdAt: new Date(t.createdAt),
        },
      });
    }
    for (const s of backup.sources) {
      await tx.source.create({
        data: {
          id: s.id,
          name: s.name,
          url: s.url,
          sourceTypeId: s.sourceTypeId,
          createdAt: new Date(s.createdAt),
        },
      });
    }
    for (const w of backup.words) {
      await tx.word.create({
        data: {
          id: w.id,
          term: w.term,
          termKey: w.term.toLowerCase(),
          definitionEn: w.definitionEn,
          definitionPt: w.definitionPt,
          examples: JSON.stringify(w.examples),
          easeFactor: w.easeFactor,
          intervalDays: w.intervalDays,
          repetitions: w.repetitions,
          nextReview: new Date(w.nextReview),
          createdAt: new Date(w.createdAt),
        },
      });
    }
    for (const s of backup.wordSightings) {
      await tx.wordSighting.create({
        data: {
          id: s.id,
          wordId: s.wordId,
          sourceId: s.sourceId,
          seenAt: new Date(s.seenAt),
          contextSentence: s.contextSentence,
          isFirstEncounter: s.isFirstEncounter,
        },
      });
    }
    for (const l of backup.reviewLogs) {
      await tx.reviewLog.create({
        data: {
          id: l.id,
          wordId: l.wordId,
          quality: l.quality,
          reviewedAt: new Date(l.reviewedAt),
          intervalDays: l.intervalDays,
        },
      });
    }
    for (const e of backup.exams) {
      await tx.exam.create({
        data: {
          id: e.id,
          type: e.type,
          sourceId: e.sourceId,
          status: e.status,
          promptText: e.promptText,
          answersText: e.answersText,
          correctionPrompt: e.correctionPrompt,
          resultJson: e.resultJson ? JSON.stringify(e.resultJson) : null,
          score: e.score,
          createdAt: new Date(e.createdAt),
        },
      });
    }
    for (const ew of backup.examWords) {
      await tx.examWord.create({
        data: {
          id: ew.id,
          examId: ew.examId,
          wordId: ew.wordId,
          correct: ew.correct,
        },
      });
    }
  });
}
