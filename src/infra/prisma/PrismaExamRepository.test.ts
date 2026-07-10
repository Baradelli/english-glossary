import { beforeEach, describe, expect, it } from "vitest";
import { getTestPrisma, resetDb } from "../../../test/helpers/db.js";
import { PrismaExamRepository } from "./PrismaExamRepository.js";
import { PrismaWordRepository } from "./PrismaWordRepository.js";
import type { ExamResult } from "../../domain/exam/examResult.js";
import type {
  NewExamQuestion,
  WordCorrection,
} from "../../domain/ports/repositories.js";

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

/** A multiple-choice question anchored to `wordId` at the given position. */
function mcQuestion(wordId: string, position: number): NewExamQuestion {
  return {
    wordId,
    position,
    type: "mc_en_pt",
    prompt: `Qual é o significado de "w${position}"?`,
    options: ["divagar", "prolixo", "quebrar o gelo", "atalho"],
    correctIndex: 0,
    correctAnswer: null,
    contextSentence: null,
    explanation: null,
    optionExplanations: [
      "É a tradução correta.",
      "Descreve uma fala longa, não o verbo.",
      "É uma expressão diferente.",
      "Significa shortcut.",
    ],
  };
}

/** A typed (active recall) question anchored to `wordId`. */
function typedQuestion(wordId: string, position: number): NewExamQuestion {
  return {
    wordId,
    position,
    type: "typed",
    prompt: "Digite o termo em inglês para: divagar",
    options: null,
    correctIndex: null,
    correctAnswer: "ramble",
    contextSentence: "Sorry, I ramble.",
    explanation: null,
    optionExplanations: null,
  };
}

describe("PrismaExamRepository — createQuiz", () => {
  it("creates an 'em_andamento' exam with its questions in one shot", async () => {
    const w1 = await aWord("ramble");
    const w2 = await aWord("rambling");

    const exam = await repo.createQuiz({
      type: "vocabulario",
      questions: [mcQuestion(w1, 0), typedQuestion(w2, 1)],
    });

    expect(exam.status).toBe("em_andamento");
    expect(exam.type).toBe("vocabulario");
    expect(exam.promptText).toBe("");
    expect(exam.finishedAt).toBeNull();
    expect(exam.practiceOfId).toBeNull();

    const questions = await repo.listQuestions(exam.id);
    expect(questions).toHaveLength(2);
    expect(questions[0]?.options).toEqual([
      "divagar",
      "prolixo",
      "quebrar o gelo",
      "atalho",
    ]);
    expect(questions[0]?.optionExplanations).toEqual([
      "É a tradução correta.",
      "Descreve uma fala longa, não o verbo.",
      "É uma expressão diferente.",
      "Significa shortcut.",
    ]);
    expect(questions[0]?.answeredAt).toBeNull();
  });

  it("stores the practice link when given", async () => {
    const w1 = await aWord("ramble");
    const origin = await repo.createQuiz({
      type: "vocabulario",
      questions: [mcQuestion(w1, 0)],
    });
    const practice = await repo.createQuiz({
      type: "pratica",
      practiceOfId: origin.id,
      questions: [typedQuestion(w1, 0)],
    });
    expect(practice.practiceOfId).toBe(origin.id);
  });

  it("is atomic: a duplicate position persists neither exam nor questions", async () => {
    const w1 = await aWord("ramble");
    const w2 = await aWord("rambling");

    await expect(
      repo.createQuiz({
        type: "semanal",
        questions: [mcQuestion(w1, 0), typedQuestion(w2, 0)], // position clash
      }),
    ).rejects.toThrow();

    expect(await prisma.exam.count()).toBe(0);
    expect(await prisma.examQuestion.count()).toBe(0);
  });
});

describe("PrismaExamRepository — listQuestions / findQuestionById", () => {
  it("lists questions ordered by position regardless of insert order", async () => {
    const w1 = await aWord("ramble");
    const w2 = await aWord("rambling");
    const w3 = await aWord("shortcut");
    const exam = await repo.createQuiz({
      type: "vocabulario",
      questions: [
        typedQuestion(w3, 2),
        mcQuestion(w1, 0),
        typedQuestion(w2, 1),
      ],
    });
    const positions = (await repo.listQuestions(exam.id)).map((q) => q.position);
    expect(positions).toEqual([0, 1, 2]);
  });

  it("finds a question by id and returns null for an unknown id", async () => {
    const w1 = await aWord("ramble");
    const exam = await repo.createQuiz({
      type: "vocabulario",
      questions: [typedQuestion(w1, 0)],
    });
    const [q] = await repo.listQuestions(exam.id);
    expect((await repo.findQuestionById(q!.id))?.correctAnswer).toBe("ramble");
    expect(await repo.findQuestionById("missing")).toBeNull();
  });
});

describe("PrismaExamRepository — answerQuestion (idempotency)", () => {
  it("writes the graded answer onto an unanswered question", async () => {
    const w1 = await aWord("ramble");
    const exam = await repo.createQuiz({
      type: "vocabulario",
      questions: [typedQuestion(w1, 0)],
    });
    const [q] = await repo.listQuestions(exam.id);

    const answered = await repo.answerQuestion(q!.id, {
      userAnswer: "rambel",
      isCorrect: true,
      answeredAt: NOW,
    });

    expect(answered.userAnswer).toBe("rambel");
    expect(answered.isCorrect).toBe(true);
    expect(answered.answeredAt?.toISOString()).toBe(NOW.toISOString());
  });

  it("rejects a second answer and keeps the first one intact", async () => {
    const w1 = await aWord("ramble");
    const exam = await repo.createQuiz({
      type: "vocabulario",
      questions: [typedQuestion(w1, 0)],
    });
    const [q] = await repo.listQuestions(exam.id);
    await repo.answerQuestion(q!.id, {
      userAnswer: "ramble",
      isCorrect: true,
      answeredAt: NOW,
    });

    await expect(
      repo.answerQuestion(q!.id, {
        userAnswer: "other",
        isCorrect: false,
        answeredAt: LATER,
      }),
    ).rejects.toThrow("Questão já respondida.");

    const stored = await repo.findQuestionById(q!.id);
    expect(stored?.userAnswer).toBe("ramble");
    expect(stored?.isCorrect).toBe(true);
  });
});

describe("PrismaExamRepository — findInProgressByType", () => {
  it("returns the open quiz of the type, ignoring other types and statuses", async () => {
    const w1 = await aWord("ramble");
    const open = await repo.createQuiz({
      type: "vocabulario",
      questions: [typedQuestion(w1, 0)],
    });
    await repo.create({ type: "semanal", promptText: "legacy" }); // 'gerada'

    expect((await repo.findInProgressByType("vocabulario"))?.id).toBe(open.id);
    expect(await repo.findInProgressByType("semanal")).toBeNull();
  });
});

describe("PrismaExamRepository — finishQuiz (transaction)", () => {
  it("finalizes the quiz and writes ExamWord + SRS + ReviewLog per word", async () => {
    const wRight = await aWord("ramble");
    const wWrong = await aWord("rambling");
    const exam = await repo.createQuiz({
      type: "vocabulario",
      questions: [mcQuestion(wRight, 0), typedQuestion(wWrong, 1)],
    });

    const finished = await repo.finishQuiz(exam.id, {
      score: 50,
      finishedAt: LATER,
      words: [correctionFor(wRight, true), correctionFor(wWrong, false)],
    });

    expect(finished.status).toBe("finalizada");
    expect(finished.score).toBe(50);
    expect(finished.finishedAt?.toISOString()).toBe(LATER.toISOString());

    expect(await prisma.examWord.count({ where: { examId: exam.id } })).toBe(2);
    expect((await words.findById(wRight))?.intervalDays).toBe(6);
    expect(await prisma.reviewLog.count()).toBe(2);
  });

  it("is all-or-nothing: an invalid word rolls everything back", async () => {
    const real = await aWord("ramble");
    const exam = await repo.createQuiz({
      type: "vocabulario",
      questions: [typedQuestion(real, 0)],
    });

    await expect(
      repo.finishQuiz(exam.id, {
        score: 50,
        finishedAt: LATER,
        words: [correctionFor(real, true), correctionFor("ghost-id", false)],
      }),
    ).rejects.toThrow();

    // Nothing persisted: quiz still open, no exam-words, no logs, SRS intact.
    expect((await repo.findById(exam.id))?.status).toBe("em_andamento");
    expect((await repo.findById(exam.id))?.finishedAt).toBeNull();
    expect(await prisma.examWord.count()).toBe(0);
    expect(await prisma.reviewLog.count()).toBe(0);
    expect((await words.findById(real))?.intervalDays).toBe(0);
  });

  it("rejects an exam that is not 'em_andamento' without writing anything", async () => {
    const w1 = await aWord("ramble");
    const legacy = await repo.create({ type: "vocabulario", promptText: "p" });

    await expect(
      repo.finishQuiz(legacy.id, {
        score: 100,
        finishedAt: LATER,
        words: [correctionFor(w1, true)],
      }),
    ).rejects.toThrow("Prova não está em andamento");

    expect((await repo.findById(legacy.id))?.status).toBe("gerada");
    expect(await prisma.examWord.count()).toBe(0);
    expect(await prisma.reviewLog.count()).toBe(0);
  });

  it("rejects a double close (already 'finalizada')", async () => {
    const w1 = await aWord("ramble");
    const exam = await repo.createQuiz({
      type: "vocabulario",
      questions: [typedQuestion(w1, 0)],
    });
    await repo.finishQuiz(exam.id, {
      score: 100,
      finishedAt: LATER,
      words: [correctionFor(w1, true)],
    });

    await expect(
      repo.finishQuiz(exam.id, {
        score: 0,
        finishedAt: LATER,
        words: [correctionFor(w1, false)],
      }),
    ).rejects.toThrow();

    // The first close stands untouched.
    expect((await repo.findById(exam.id))?.score).toBe(100);
    expect(await prisma.examWord.count()).toBe(1);
    expect(await prisma.reviewLog.count()).toBe(1);
  });
});

describe("PrismaExamRepository — listWordResults", () => {
  it("returns every ExamWord row across multiple exams", async () => {
    const w1 = await aWord("ramble");
    const w2 = await aWord("rambling");
    const quizA = await repo.createQuiz({
      type: "vocabulario",
      questions: [mcQuestion(w1, 0), typedQuestion(w2, 1)],
    });
    await repo.finishQuiz(quizA.id, {
      score: 50,
      finishedAt: LATER,
      words: [correctionFor(w1, true), correctionFor(w2, false)],
    });
    const quizB = await repo.createQuiz({
      type: "semanal",
      questions: [typedQuestion(w2, 0)],
    });
    await repo.finishQuiz(quizB.id, {
      score: 0,
      finishedAt: LATER,
      words: [correctionFor(w2, false)],
    });

    const results = await repo.listWordResults();
    expect(results).toHaveLength(3);
    expect(new Set(results.map((r) => r.examId))).toEqual(
      new Set([quizA.id, quizB.id]),
    );
    // w2 missed both times, w1 hit once.
    expect(results.filter((r) => r.wordId === w2 && !r.correct)).toHaveLength(2);
    expect(results.filter((r) => r.wordId === w1 && r.correct)).toHaveLength(1);
  });

  it("returns an empty list when no exam was ever corrected", async () => {
    expect(await repo.listWordResults()).toEqual([]);
  });
});

describe("PrismaExamRepository — legacy rows", () => {
  it("maps a legacy exam (no questions) with null quiz fields", async () => {
    const legacy = await repo.create({ type: "semanal", promptText: "p" });
    const found = await repo.findById(legacy.id);
    expect(found?.finishedAt).toBeNull();
    expect(found?.practiceOfId).toBeNull();
    expect(await repo.listQuestions(legacy.id)).toEqual([]);
  });
});
