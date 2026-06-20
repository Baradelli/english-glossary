import { beforeEach, describe, expect, it } from "vitest";
import { getTestPrisma, resetDb } from "../../../test/helpers/db.js";
import { exportAll, importAll, BackupSchema } from "./backup.js";
import { PrismaExamRepository } from "../prisma/PrismaExamRepository.js";
import { PrismaSourceRepository } from "../prisma/PrismaSourceRepository.js";
import { PrismaSourceTypeRepository } from "../prisma/PrismaSourceTypeRepository.js";
import { PrismaWordRepository } from "../prisma/PrismaWordRepository.js";
import type { ExamResult } from "../../domain/exam/examResult.js";

const prisma = getTestPrisma();
const types = new PrismaSourceTypeRepository(prisma);
const sources = new PrismaSourceRepository(prisma);
const words = new PrismaWordRepository(prisma);
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
  await words.recordSighting(ramble.id, {
    sourceId,
    seenAt: NOW,
    contextSentence: "Sorry, I ramble.",
    isFirstEncounter: true,
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
    expect(dump.version).toBe(1);
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
