import { beforeEach, describe, expect, it } from "vitest";
import { getTestPrisma, resetDb } from "../../../test/helpers/db.js";
import { PrismaExamRepository } from "./PrismaExamRepository.js";
import { PrismaWordRepository } from "./PrismaWordRepository.js";
import type { ExamResult } from "../../domain/exam/examResult.js";
import type { WordCorrection } from "../../domain/ports/repositories.js";

const prisma = getTestPrisma();
const repo = new PrismaExamRepository(prisma);
const words = new PrismaWordRepository(prisma);

const NOW = new Date("2026-06-19T00:00:00.000Z");
const LATER = new Date("2026-06-20T00:00:00.000Z");

async function aWord(term: string): Promise<string> {
  const w = await words.create({
    term,
    definitionEn: "x",
    definitionPt: "y",
    examples: [],
    nextReview: NOW,
  });
  return w.id;
}

function correctionFor(
  wordId: string,
  correct: boolean,
): WordCorrection {
  return {
    wordId,
    correct,
    srs: { easeFactor: 2.6, intervalDays: 6, repetitions: 2, nextReview: LATER },
    reviewLog: { quality: correct ? 5 : 1, reviewedAt: NOW },
  };
}

beforeEach(resetDb);

describe("PrismaExamRepository — create", () => {
  it("creates an exam in status 'gerada' with the prompt text", async () => {
    const exam = await repo.create({
      type: "vocabulario",
      promptText: "prova...",
    });
    expect(exam.status).toBe("gerada");
    expect(exam.type).toBe("vocabulario");
    expect(exam.promptText).toBe("prova...");
    expect(exam.resultJson).toBeNull();
    expect(exam.score).toBeNull();
  });

  it("finds an exam by id", async () => {
    const created = await repo.create({ type: "semanal", promptText: "p" });
    expect((await repo.findById(created.id))?.id).toBe(created.id);
  });

  it("returns null for an unknown id", async () => {
    expect(await repo.findById("missing")).toBeNull();
  });

  it("honours an injected createdAt", async () => {
    const createdAt = new Date("2020-01-02T03:04:05.000Z");
    const exam = await repo.create({
      type: "semanal",
      promptText: "p",
      createdAt,
    });
    expect(exam.createdAt.toISOString()).toBe(createdAt.toISOString());
  });

  it("listAll returns every exam, newest first", async () => {
    const a = await repo.create({
      type: "semanal",
      promptText: "a",
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
    });
    const b = await repo.create({
      type: "vocabulario",
      promptText: "b",
      createdAt: new Date("2026-06-20T00:00:00.000Z"),
    });
    const ids = (await repo.listAll()).map((e) => e.id);
    expect(ids).toEqual([b.id, a.id]);
  });

  it("saveAnswers stores answers + correction prompt and moves to respondida", async () => {
    const exam = await repo.create({ type: "vocabulario", promptText: "p" });
    const updated = await repo.saveAnswers(exam.id, {
      answersText: "minhas respostas",
      correctionPrompt: "corrija isto",
    });
    expect(updated.status).toBe("respondida");
    expect(updated.answersText).toBe("minhas respostas");
    expect(updated.correctionPrompt).toBe("corrija isto");
  });
});

describe("PrismaExamRepository — submitCorrection (transaction §5)", () => {
  const result: ExamResult = {
    score: 50,
    items: [
      { term: "ramble", correct: true, note: "ok" },
      { term: "rambling", correct: false, note: "errou" },
    ],
    feedback: "ok",
  };

  it("marks the exam corrigida, stores the typed result, and links words", async () => {
    const wRight = await aWord("ramble");
    const wWrong = await aWord("rambling");
    const exam = await repo.create({ type: "vocabulario", promptText: "p" });

    const updated = await repo.submitCorrection(exam.id, {
      resultJson: result,
      score: 50,
      words: [correctionFor(wRight, true), correctionFor(wWrong, false)],
    });

    expect(updated.status).toBe("corrigida");
    expect(updated.score).toBe(50);
    expect(updated.resultJson).toEqual(result);

    const examWords = await prisma.examWord.findMany({
      where: { examId: exam.id },
    });
    expect(examWords).toHaveLength(2);

    // SRS of each affected word was updated...
    expect((await words.findById(wRight))?.intervalDays).toBe(6);
    // ...and a review log was written per word.
    expect(await prisma.reviewLog.count()).toBe(2);
  });

  it("rolls back entirely if any word in the correction is invalid", async () => {
    const real = await aWord("ramble");
    const exam = await repo.create({ type: "vocabulario", promptText: "p" });

    await expect(
      repo.submitCorrection(exam.id, {
        resultJson: result,
        score: 50,
        words: [correctionFor(real, true), correctionFor("ghost-id", false)],
      }),
    ).rejects.toThrow();

    // Nothing persisted: exam still 'gerada', no exam-words, no logs, SRS intact.
    expect((await repo.findById(exam.id))?.status).toBe("gerada");
    expect(await prisma.examWord.count()).toBe(0);
    expect(await prisma.reviewLog.count()).toBe(0);
    expect((await words.findById(real))?.intervalDays).toBe(0);
  });
});
