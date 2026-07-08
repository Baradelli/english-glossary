import { beforeEach, describe, expect, it } from "vitest";
import { getTestPrisma, resetDb } from "../../../test/helpers/db.js";
import {
  exportAll,
  importAll,
  replaceAll,
  BackupSchema,
  type Backup,
} from "./backup.js";
import { PrismaExamRepository } from "../prisma/PrismaExamRepository.js";
import { PrismaSourceRepository } from "../prisma/PrismaSourceRepository.js";
import { PrismaSourceTypeRepository } from "../prisma/PrismaSourceTypeRepository.js";
import { PrismaWordRepository } from "../prisma/PrismaWordRepository.js";
import { PrismaWordSightingRepository } from "../prisma/PrismaWordSightingRepository.js";
import type { ExamResult } from "../../domain/exam/examResult.js";

const prisma = getTestPrisma();
const types = new PrismaSourceTypeRepository(prisma);
const sources = new PrismaSourceRepository(prisma);
const words = new PrismaWordRepository(prisma);
const sightings = new PrismaWordSightingRepository(prisma);
const exams = new PrismaExamRepository(prisma);

const NOW = new Date("2026-06-19T00:00:00.000Z");
const LATER = new Date("2026-06-20T00:00:00.000Z");

/** Seeds a realistic, fully-populated state across all 7 tables. */
async function seed(): Promise<void> {
  const typeId = (await types.create("Vídeo")).id;
  const sourceId = (
    await sources.create({ name: "Fireship", url: "https://y/1", sourceTypeId: typeId })
  ).id;
  const ramble = await words.create({
    term: "ramble",
    definitionEn: "to talk at length",
    definitionPt: "divagar",
    examples: ["He started to ramble.", "I ramble a lot."],
    nextReview: NOW,
  });
  const rambling = await words.create({
    term: "rambling",
    definitionEn: "lengthy and confused",
    definitionPt: "prolixo",
    examples: [],
    nextReview: NOW,
  });
  // A fixed expression (kind: "expressao") — must survive an export→restore
  // round trip without being demoted to "palavra" (the v1 backup bug).
  await words.create({
    term: "break the ice",
    kind: "expressao",
    definitionEn: "to initiate conversation in a social setting",
    definitionPt: "quebrar o gelo",
    examples: ["A joke can break the ice."],
    nextReview: NOW,
  });
  const sighting = await sightings.record({
    wordId: ramble.id,
    sourceId,
    seenAt: NOW,
    contextSentence: "Sorry, I ramble.",
    isFirstEncounter: true,
  });
  await sightings.update(sighting.id, {
    definitionEn: "here: to talk aimlessly",
    definitionPt: "aqui: divagar sem rumo",
    examples: ["source-specific example"],
  });
  const result: ExamResult = {
    score: 50,
    items: [
      { term: "ramble", correct: true, note: "ok" },
      { term: "rambling", correct: false, note: "x" },
    ],
    feedback: "ok",
  };
  const exam = await exams.create({
    type: "vocabulario",
    sourceId,
    promptText: "prova...",
  });
  // A second, still-uncorrected exam (resultJson null) — a realistic mix.
  await exams.create({ type: "semanal", promptText: "weekly..." });
  await exams.submitCorrection(exam.id, {
    resultJson: result,
    score: 50,
    words: [
      {
        wordId: ramble.id,
        correct: true,
        srs: { easeFactor: 2.6, intervalDays: 6, repetitions: 2, nextReview: LATER },
        reviewLog: { quality: 5, reviewedAt: NOW },
      },
      {
        wordId: rambling.id,
        correct: false,
        srs: { easeFactor: 2.5, intervalDays: 1, repetitions: 0, nextReview: LATER },
        reviewLog: { quality: 1, reviewedAt: NOW },
      },
    ],
  });
}

beforeEach(resetDb);

describe("backup — exportAll", () => {
  it("dumps an empty database as empty arrays with a version", async () => {
    const dump = await exportAll(prisma);
    expect(dump.version).toBe(2);
    expect(dump.words).toEqual([]);
    expect(dump.exams).toEqual([]);
  });

  it("exports an uncorrected exam with a null resultJson", async () => {
    await exams.create({ type: "semanal", promptText: "p" });
    const dump = await exportAll(prisma);
    expect(dump.exams).toHaveLength(1);
    expect(dump.exams[0]?.resultJson).toBeNull();
  });

  it("decodes examples and resultJson into rich JSON (not double-encoded)", async () => {
    await seed();
    const dump = await exportAll(prisma);
    expect(dump.words.find((w) => w.term === "ramble")?.examples).toEqual([
      "He started to ramble.",
      "I ramble a lot.",
    ]);
    expect(dump.exams[0]?.resultJson?.score).toBe(50);
  });
});

describe("backup — round trip (§4 acceptance)", () => {
  it("export -> wipe -> import reconstructs an identical state", async () => {
    await seed();
    const before = await exportAll(prisma);

    // Simulate writing to a file and reading it back.
    const onDisk: unknown = JSON.parse(JSON.stringify(before));

    await resetDb();
    expect((await exportAll(prisma)).words).toEqual([]); // truly empty

    await importAll(prisma, onDisk);
    const after = await exportAll(prisma);

    expect(after).toEqual(before);
  });
});

describe("backup — importAll validation", () => {
  it("rejects a malformed backup without writing anything", async () => {
    await expect(importAll(prisma, { version: 2 })).rejects.toThrow();
    await expect(importAll(prisma, { nope: true })).rejects.toThrow();
    expect((await exportAll(prisma)).words).toEqual([]);
  });

  it("BackupSchema accepts a well-formed empty backup", () => {
    const empty = {
      version: 1,
      sourceTypes: [],
      sources: [],
      words: [],
      wordSightings: [],
      reviewLogs: [],
      exams: [],
      examWords: [],
    };
    expect(BackupSchema.safeParse(empty).success).toBe(true);
  });
});

describe("backup — v1 compatibility (import defaults kind)", () => {
  it("imports a v1 payload (no kind) with words defaulting to 'palavra'", async () => {
    const v1 = {
      version: 1,
      sourceTypes: [],
      sources: [],
      words: [
        {
          id: "w1",
          term: "hello",
          definitionEn: "a greeting",
          definitionPt: "olá",
          examples: [],
          easeFactor: 2.5,
          intervalDays: 0,
          repetitions: 0,
          nextReview: NOW.toISOString(),
          createdAt: NOW.toISOString(),
        },
      ],
      wordSightings: [],
      reviewLogs: [],
      exams: [],
      examWords: [],
    };
    await importAll(prisma, v1);
    const stored = await prisma.word.findUnique({ where: { id: "w1" } });
    expect(stored?.kind).toBe("palavra");
    // And the re-export tags the whole file as v2 going forward.
    expect((await exportAll(prisma)).version).toBe(2);
  });
});

describe("backup — replaceAll (restore = wipe + import, transactional)", () => {
  it("round trips v2, preserving kind, and wipes prior data", async () => {
    await seed();
    const before = await exportAll(prisma);
    expect(before.version).toBe(2);
    expect(before.words.some((w) => w.kind === "expressao")).toBe(true);

    // Simulate writing to a file and reading it back.
    const onDisk: unknown = JSON.parse(JSON.stringify(before));

    // Mutate the live DB: a stray word that must NOT survive the restore.
    await words.create({
      term: "stray",
      definitionEn: "should be wiped",
      definitionPt: "deve sumir",
      examples: [],
      nextReview: NOW,
    });
    expect(await prisma.word.count()).toBe(before.words.length + 1);

    const result = await replaceAll(prisma, onDisk);
    expect(result.ok).toBe(true);

    const after = await exportAll(prisma);
    expect(after).toEqual(before);
    expect(after.words.find((w) => w.term === "break the ice")?.kind).toBe(
      "expressao",
    );
    expect(after.words.some((w) => w.term === "stray")).toBe(false);
  });

  it("rejects an invalid payload without deleting anything", async () => {
    await seed();
    const wordsBefore = await prisma.word.count();
    const sightingsBefore = await prisma.wordSighting.count();
    const examsBefore = await prisma.exam.count();
    expect(wordsBefore).toBeGreaterThan(0);

    const result = await replaceAll(prisma, { version: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Arquivo de backup inválido:");
    }

    // Nothing was wiped.
    expect(await prisma.word.count()).toBe(wordsBefore);
    expect(await prisma.wordSighting.count()).toBe(sightingsBefore);
    expect(await prisma.exam.count()).toBe(examsBefore);
  });

  it("leaves the Setting table untouched (out of backup and out of wipe)", async () => {
    await seed();
    await prisma.setting.create({ data: { key: "ai.apiKey", value: "secret" } });

    const onDisk: unknown = JSON.parse(JSON.stringify(await exportAll(prisma)));
    const result = await replaceAll(prisma, onDisk);
    expect(result.ok).toBe(true);

    const setting = await prisma.setting.findUnique({
      where: { key: "ai.apiKey" },
    });
    expect(setting?.value).toBe("secret");
  });

  it("returns a friendly error and rolls back when the backup is referentially broken", async () => {
    await seed();
    const wordsBefore = await prisma.word.count();
    const sightingsBefore = await prisma.wordSighting.count();
    const sourcesBefore = await prisma.source.count();
    const examsBefore = await prisma.exam.count();
    expect(wordsBefore).toBeGreaterThan(0);

    // Schema-valid (passes BackupSchema) but referentially broken: the
    // sighting points at a word that doesn't exist anywhere in the payload.
    // SQLite has foreign_keys enabled, so the insert throws mid-transaction.
    const broken: Backup = {
      version: 2,
      sourceTypes: [{ id: "st1", name: "Vídeo", createdAt: NOW.toISOString() }],
      sources: [
        {
          id: "src1",
          name: "Fireship",
          url: null,
          sourceTypeId: "st1",
          createdAt: NOW.toISOString(),
        },
      ],
      words: [],
      wordSightings: [
        {
          id: "sight1",
          wordId: "does-not-exist",
          sourceId: "src1",
          seenAt: NOW.toISOString(),
          contextSentence: null,
          isFirstEncounter: true,
          definitionEn: null,
          definitionPt: null,
          examples: [],
        },
      ],
      reviewLogs: [],
      exams: [],
      examWords: [],
    };
    expect(BackupSchema.safeParse(broken).success).toBe(true);

    const result = await replaceAll(prisma, broken);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        "Não foi possível restaurar o backup — nenhum dado foi alterado.",
      );
    }

    // Rollback: prior data (across the whole schema) is untouched.
    expect(await prisma.word.count()).toBe(wordsBefore);
    expect(await prisma.wordSighting.count()).toBe(sightingsBefore);
    expect(await prisma.source.count()).toBe(sourcesBefore);
    expect(await prisma.exam.count()).toBe(examsBefore);
  });
});
