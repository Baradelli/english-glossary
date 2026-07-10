/**
 * Full-database export/import (§2, §4). The SQLite file is the canonical store,
 * but a versioned JSON dump is a first-class backup: human-readable, diffable,
 * and round-trippable.
 *
 * Dates are ISO strings and the JSON-encoded columns (Word.examples,
 * Exam.resultJson) are decoded into rich JSON, so the backup file is clean
 * rather than double-encoded. Import/restore validate the file against {@link
 * BackupSchema} and write everything in one transaction, recomputing the
 * normalized key columns.
 *
 * Versioning: v1 files predate `Word.kind` and omit it entirely; the schema's
 * `.default("palavra")` imports them faithfully (every entry was a plain word
 * back then). v2 carries `kind` so a round trip no longer demotes fixed
 * expressions to "palavra". v3 adds the local quiz engine: `examQuestions`
 * (default [] so v1/v2 files import unchanged) plus `Exam.finishedAt` and
 * `Exam.practiceOfId` (defaults null). {@link exportAll} always emits v3.
 *
 * Scope: the `Setting` table (machine-local configuration such as the API key)
 * is deliberately OUTSIDE the backup — it is neither exported nor touched by a
 * restore's wipe. Restoring study data must never clobber the machine's config.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
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
  // Absent in v1 files → imported as "palavra" (the pre-kind default).
  kind: z.enum(["palavra", "expressao"]).default("palavra"),
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
  definitionEn: z.string().nullable(),
  definitionPt: z.string().nullable(),
  examples: z.array(z.string()),
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
  // Absent in v1/v2 files → null (the quiz engine landed in v3).
  finishedAt: Iso.nullable().default(null),
  practiceOfId: z.string().nullable().default(null),
  createdAt: Iso,
});
const ExamWordBackup = z.object({
  id: z.string(),
  examId: z.string(),
  wordId: z.string(),
  correct: z.boolean(),
});
const ExamQuestionBackup = z.object({
  id: z.string(),
  examId: z.string(),
  wordId: z.string(),
  position: z.number().int(),
  type: z.string(),
  prompt: z.string(),
  options: z.array(z.string()).nullable(),
  correctIndex: z.number().int().nullable(),
  correctAnswer: z.string().nullable(),
  contextSentence: z.string().nullable(),
  // Absent in pre-ADR-009 files → imported as null.
  explanation: z.string().nullable().default(null),
  userAnswer: z.string().nullable(),
  isCorrect: z.boolean().nullable(),
  answeredAt: Iso.nullable(),
});

export const BackupSchema = z.object({
  version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  sourceTypes: z.array(SourceTypeBackup),
  sources: z.array(SourceBackup),
  words: z.array(WordBackup),
  wordSightings: z.array(WordSightingBackup),
  reviewLogs: z.array(ReviewLogBackup),
  exams: z.array(ExamBackup),
  examWords: z.array(ExamWordBackup),
  // Absent in v1/v2 files → imported as an empty table.
  examQuestions: z.array(ExamQuestionBackup).default([]),
});

export type Backup = z.infer<typeof BackupSchema>;

export async function exportAll(prisma: PrismaClient): Promise<Backup> {
  const [
    sourceTypes,
    sources,
    words,
    wordSightings,
    reviewLogs,
    exams,
    examWords,
    examQuestions,
  ] = await Promise.all([
    prisma.sourceType.findMany(),
    prisma.source.findMany(),
    prisma.word.findMany(),
    prisma.wordSighting.findMany(),
    prisma.reviewLog.findMany(),
    prisma.exam.findMany(),
    prisma.examWord.findMany(),
    prisma.examQuestion.findMany(),
  ]);

  return {
    version: 3,
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
      // Coerce rather than cast: a corrupted DB value must not silently
      // produce a backup that later fails restore's own schema validation.
      kind: r.kind === "expressao" ? "expressao" : "palavra",
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
      definitionEn: r.definitionEn,
      definitionPt: r.definitionPt,
      examples: r.examples ? z.array(z.string()).parse(JSON.parse(r.examples)) : [],
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
      finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
      practiceOfId: r.practiceOfId,
      createdAt: r.createdAt.toISOString(),
    })),
    examWords: examWords.map((r) => ({
      id: r.id,
      examId: r.examId,
      wordId: r.wordId,
      correct: r.correct,
    })),
    examQuestions: examQuestions.map((r) => ({
      id: r.id,
      examId: r.examId,
      wordId: r.wordId,
      position: r.position,
      type: r.type,
      prompt: r.prompt,
      options: r.options ? z.array(z.string()).parse(JSON.parse(r.options)) : null,
      correctIndex: r.correctIndex,
      correctAnswer: r.correctAnswer,
      contextSentence: r.contextSentence,
      explanation: r.explanation,
      userAnswer: r.userAnswer,
      isCorrect: r.isCorrect,
      answeredAt: r.answeredAt ? r.answeredAt.toISOString() : null,
    })),
  };
}

/**
 * Writes a validated backup in FK-safe order using the given transaction
 * client. Recomputes the normalized key columns. Assumes the target tables are
 * empty (callers wipe first or start empty). Shared by {@link importAll} and
 * {@link replaceAll}.
 */
async function insertAll(
  tx: Prisma.TransactionClient,
  backup: Backup,
): Promise<void> {
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
        kind: w.kind,
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
        definitionEn: s.definitionEn,
        definitionPt: s.definitionPt,
        examples: JSON.stringify(s.examples),
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
  // Exams in TWO passes: practiceOfId is a self-FK, and a practice exam may
  // appear in the file before its origin. Create everything with the link
  // nulled first, then wire the links once every exam exists.
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
        finishedAt: e.finishedAt ? new Date(e.finishedAt) : null,
        practiceOfId: null,
        createdAt: new Date(e.createdAt),
      },
    });
  }
  for (const e of backup.exams) {
    if (e.practiceOfId !== null) {
      await tx.exam.update({
        where: { id: e.id },
        data: { practiceOfId: e.practiceOfId },
      });
    }
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
  for (const q of backup.examQuestions) {
    await tx.examQuestion.create({
      data: {
        id: q.id,
        examId: q.examId,
        wordId: q.wordId,
        position: q.position,
        type: q.type,
        prompt: q.prompt,
        options: q.options === null ? null : JSON.stringify(q.options),
        correctIndex: q.correctIndex,
        correctAnswer: q.correctAnswer,
        contextSentence: q.contextSentence,
        explanation: q.explanation,
        userAnswer: q.userAnswer,
        isCorrect: q.isCorrect,
        answeredAt: q.answeredAt ? new Date(q.answeredAt) : null,
      },
    });
  }
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
  await prisma.$transaction((tx) => insertAll(tx, backup));
}

/**
 * Restores a backup by REPLACING all study data: wipe every table then
 * re-insert. The parse happens OUTSIDE and BEFORE the transaction so an invalid
 * file can never delete anything. The wipe + re-insert run in a single
 * all-or-nothing transaction, in FK-reverse then FK-safe order. The `Setting`
 * table is never touched (machine-local config survives a restore).
 */
export async function replaceAll(
  prisma: PrismaClient,
  data: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = BackupSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: `Arquivo de backup inválido: ${issue?.message ?? "formato inesperado"}`,
    };
  }
  const backup = parsed.data;

  try {
    await prisma.$transaction(
      async (tx) => {
        // FK-reverse wipe (children before parents); Setting is excluded.
        await tx.examQuestion.deleteMany();
        await tx.examWord.deleteMany();
        await tx.exam.deleteMany();
        await tx.reviewLog.deleteMany();
        await tx.wordSighting.deleteMany();
        await tx.word.deleteMany();
        await tx.source.deleteMany();
        await tx.sourceType.deleteMany();
        await insertAll(tx, backup);
      },
      { timeout: 60_000 },
    );
  } catch (err) {
    // The file passed schema validation but is referentially broken (e.g. a
    // sighting/word pointing at an id absent from the payload) — SQLite's
    // foreign_keys pragma throws mid-transaction, which rolls everything
    // back. No data was lost; report it the same friendly way as a schema
    // failure instead of letting the throw escape as a generic server error.
    console.error("[backup] replaceAll failed:", err);
    return {
      ok: false,
      error: "Não foi possível restaurar o backup — nenhum dado foi alterado.",
    };
  }

  return { ok: true };
}
