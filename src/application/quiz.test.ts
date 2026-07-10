import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTestPrisma, resetDb } from "../../test/helpers/db.js";
import { createRepositories } from "../infra/prisma/repositories.js";
import {
  type AiProvider,
  type ExamQuestion,
  type QuizWordInput,
  type Word,
} from "../domain/index.js";
import {
  AI_QUIZ_FAILED_MESSAGE,
  NO_AI_PROVIDER_MESSAGE,
  answerQuizQuestion,
  finishQuiz,
  generateQuizWithAi,
  startPracticeQuiz,
  startVocabularyQuiz,
  startWeeklyQuiz,
} from "./quiz.js";

const prisma = getTestPrisma();
const repos = createRepositories(prisma);
const NOW = new Date("2026-06-19T00:00:00.000Z");
const OLD = new Date("2026-06-01T00:00:00.000Z"); // > 7 days before NOW
const SEED = 42;

/**
 * Fake provider that stands in for the API: it reads the terms the app put in
 * the generation prompt (the `- term` lines from formatWordList) and returns a
 * valid multiple-choice item per term. The correct option is always index 0
 * BEFORE the app reshuffles, so tests must answer using the PERSISTED
 * correctIndex — exactly what the real client does.
 */
function promptTerms(prompt: string): string[] {
  return [...prompt.matchAll(/^- (.+)$/gm)].map((m) => (m[1] ?? "").trim());
}

function itemsForPrompt(prompt: string): string {
  return JSON.stringify({
    items: promptTerms(prompt).map((term) => ({
      term,
      prompt: `O que significa "${term}"?`,
      options: [
        `pt ${term}`,
        `errada A ${term}`,
        `errada B ${term}`,
        `errada C ${term}`,
      ],
      optionExplanations: [
        `pt ${term} é a resposta correta.`,
        `errada A ${term} não corresponde ao termo.`,
        `errada B ${term} não corresponde ao termo.`,
        `errada C ${term} não corresponde ao termo.`,
      ],
      correctIndex: 0,
      explanation: `"${term}" significa pt ${term}.`,
    })),
  });
}

const aiProvider: AiProvider = {
  name: "fake",
  complete: async (prompt) => itemsForPrompt(prompt),
};

const deps = {
  words: repos.words,
  sightings: repos.sightings,
  exams: repos.exams,
};

const opts = { seed: SEED, ai: aiProvider };

async function makeWord(term: string, createdAt = NOW): Promise<Word> {
  return repos.words.create({
    term,
    definitionEn: `en ${term}`,
    definitionPt: `pt ${term}`,
    examples: [],
    nextReview: NOW,
    createdAt,
  });
}

const RECENT_TERMS = ["wander", "meadow", "gather", "stroll", "beacon"];

/** 5 recent words + 2 old ones; returns the recent ids. */
async function seedGlossary(): Promise<Set<string>> {
  const recent = new Set<string>();
  for (const term of RECENT_TERMS) recent.add((await makeWord(term)).id);
  await makeWord("puzzle", OLD);
  await makeWord("branch", OLD);
  return recent;
}

/** MC answers are the chosen index serialized; every AI question is MC. */
function correctAnswerFor(question: ExamQuestion): string {
  return String(question.correctIndex);
}

function wrongAnswerFor(question: ExamQuestion): string {
  const options = question.options ?? [];
  return String(((question.correctIndex ?? 0) + 1) % Math.max(options.length, 1));
}

beforeEach(resetDb);

describe("startWeeklyQuiz", () => {
  it("opens an 'em_andamento' exam with AI questions over this week's words only", async () => {
    const recentIds = await seedGlossary();

    const exam = await startWeeklyQuiz(deps, opts, NOW);

    expect(exam.type).toBe("semanal");
    expect(exam.status).toBe("em_andamento");
    expect(exam.promptText).toBe("");

    const questions = await repos.exams.listQuestions(exam.id);
    expect(questions).toHaveLength(RECENT_TERMS.length);
    expect(questions.map((q) => q.position)).toEqual([0, 1, 2, 3, 4]);
    for (const question of questions) {
      expect(recentIds.has(question.wordId)).toBe(true);
      expect(question.answeredAt).toBeNull();
      expect(question.type).toBe("ai_context");
      expect(question.options).toHaveLength(4);
    }
    // One question per word (the ExamWord-uniqueness invariant upstream).
    expect(new Set(questions.map((q) => q.wordId)).size).toBe(questions.length);
  });

  it("requires an AI provider to generate the quiz", async () => {
    await seedGlossary();
    await expect(
      startWeeklyQuiz(deps, { seed: SEED, ai: null }, NOW),
    ).rejects.toThrow(NO_AI_PROVIDER_MESSAGE);
  });

  it("throws a friendly error when nothing was captured this week", async () => {
    await makeWord("puzzle", OLD); // glossary not empty, but nothing recent
    await expect(startWeeklyQuiz(deps, opts, NOW)).rejects.toThrow(
      /última semana/,
    );
  });

  it("resumes the open quiz of the same type instead of duplicating it", async () => {
    await seedGlossary();
    const first = await startWeeklyQuiz(deps, opts, NOW);
    const second = await startWeeklyQuiz(deps, { seed: SEED + 1, ai: aiProvider }, NOW);

    expect(second.id).toBe(first.id);
    expect(await prisma.exam.count()).toBe(1);
  });
});

describe("startVocabularyQuiz", () => {
  it("throws a friendly error on an empty glossary", async () => {
    await expect(startVocabularyQuiz(deps, opts, NOW)).rejects.toThrow(
      /Glossário vazio/,
    );
  });

  it("opens an 'em_andamento' quiz over the glossary and resumes it on a second start", async () => {
    await seedGlossary();
    const exam = await startVocabularyQuiz(deps, opts, NOW);
    expect(exam.type).toBe("vocabulario");
    expect(exam.status).toBe("em_andamento");
    expect(await repos.exams.listQuestions(exam.id)).toHaveLength(7);

    const resumed = await startVocabularyQuiz(deps, { seed: SEED + 9, ai: aiProvider }, NOW);
    expect(resumed.id).toBe(exam.id);
  });
});

describe("answerQuizQuestion", () => {
  async function openWeekly() {
    await seedGlossary();
    const exam = await startWeeklyQuiz(deps, opts, NOW);
    const questions = await repos.exams.listQuestions(exam.id);
    return { exam, questions };
  }

  it("grades a correct multiple-choice answer and returns the rich feedback", async () => {
    const { exam, questions } = await openWeekly();
    const mc = questions[0] as ExamQuestion;

    const feedback = await answerQuizQuestion(
      deps,
      { examId: exam.id, questionId: mc.id, answer: String(mc.correctIndex) },
      NOW,
    );

    expect(feedback.isCorrect).toBe(true);
    expect(feedback.correctAnswer).toBe(mc.options?.[mc.correctIndex ?? -1]);
    expect(feedback.explanation).toContain(mc.options?.[mc.correctIndex ?? -1] ?? "");
    expect(feedback.answered).toBe(1);
    expect(feedback.total).toBe(questions.length);

    const persisted = await repos.exams.findQuestionById(mc.id);
    expect(persisted?.isCorrect).toBe(true);
    expect(persisted?.answeredAt).toEqual(NOW);
  });

  it("grades a wrong multiple-choice answer as incorrect", async () => {
    const { exam, questions } = await openWeekly();
    const mc = questions[0] as ExamQuestion;

    const feedback = await answerQuizQuestion(
      deps,
      { examId: exam.id, questionId: mc.id, answer: wrongAnswerFor(mc) },
      NOW,
    );
    expect(feedback.isCorrect).toBe(false);
    expect(feedback.correctAnswer).toBe(mc.options?.[mc.correctIndex ?? -1]);
  });

  it("rejects answering the same question twice", async () => {
    const { exam, questions } = await openWeekly();
    const first = questions[0] as ExamQuestion;
    await answerQuizQuestion(
      deps,
      { examId: exam.id, questionId: first.id, answer: correctAnswerFor(first) },
      NOW,
    );
    await expect(
      answerQuizQuestion(
        deps,
        { examId: exam.id, questionId: first.id, answer: "again" },
        NOW,
      ),
    ).rejects.toThrow(/já respondida/);
  });

  it("rejects a question that belongs to another exam", async () => {
    const { exam } = await openWeekly();
    const other = await startVocabularyQuiz(deps, opts, NOW);
    const otherQuestions = await repos.exams.listQuestions(other.id);
    const foreign = otherQuestions[0] as ExamQuestion;

    await expect(
      answerQuizQuestion(
        deps,
        { examId: exam.id, questionId: foreign.id, answer: "0" },
        NOW,
      ),
    ).rejects.toThrow(/não pertence/);
  });
});

describe("finishQuiz", () => {
  async function openAndAnswer(wrongCount: number) {
    await seedGlossary();
    const exam = await startWeeklyQuiz(deps, opts, NOW);
    const questions = await repos.exams.listQuestions(exam.id);
    const wrongWordIds: string[] = [];
    for (const [index, question] of questions.entries()) {
      const wrong = index < wrongCount;
      if (wrong) wrongWordIds.push(question.wordId);
      await answerQuizQuestion(
        deps,
        {
          examId: exam.id,
          questionId: question.id,
          answer: wrong ? wrongAnswerFor(question) : correctAnswerFor(question),
        },
        NOW,
      );
    }
    return { exam, questions, wrongWordIds };
  }

  it("rejects while questions are still unanswered", async () => {
    await seedGlossary();
    const exam = await startWeeklyQuiz(deps, opts, NOW);
    const [first] = await repos.exams.listQuestions(exam.id);
    await answerQuizQuestion(
      deps,
      {
        examId: exam.id,
        questionId: (first as ExamQuestion).id,
        answer: correctAnswerFor(first as ExamQuestion),
      },
      NOW,
    );

    await expect(finishQuiz(deps, exam.id, NOW)).rejects.toThrow(
      /questões sem resposta/,
    );
  });

  it("computes the score, writes unique ExamWords, applies SRS 5/2 and logs one review per word", async () => {
    const { exam, questions, wrongWordIds } = await openAndAnswer(1);

    const finished = await finishQuiz(deps, exam.id, NOW);

    expect(finished.status).toBe("finalizada");
    expect(finished.score).toBe(80); // round(100 * 4/5)
    expect(finished.finishedAt).toEqual(NOW);

    const examWords = await prisma.examWord.findMany({
      where: { examId: exam.id },
    });
    expect(examWords).toHaveLength(questions.length);
    expect(new Set(examWords.map((w) => w.wordId)).size).toBe(questions.length);

    for (const question of questions) {
      const word = await repos.words.findById(question.wordId);
      if (wrongWordIds.includes(question.wordId)) {
        // Fail = quality 2: repetitions reset.
        expect(word?.repetitions).toBe(0);
      } else {
        // Pass = quality 5: first successful review -> reps 1, interval 1.
        expect(word?.repetitions).toBe(1);
        expect(word?.intervalDays).toBe(1);
      }
      expect(await repos.reviewLogs.listByWord(question.wordId)).toHaveLength(1);
    }
  });

  it("rejects a second close (all-or-nothing guard)", async () => {
    const { exam } = await openAndAnswer(0);
    await finishQuiz(deps, exam.id, NOW);
    await expect(finishQuiz(deps, exam.id, NOW)).rejects.toThrow(
      /não está em andamento/,
    );
    // No duplicated side effects: still one log per word.
    const logs = await prisma.reviewLog.count();
    expect(logs).toBe(RECENT_TERMS.length);
  });
});

describe("startPracticeQuiz", () => {
  async function aFinishedQuiz(wrongCount: number) {
    await seedGlossary();
    const exam = await startWeeklyQuiz(deps, opts, NOW);
    const questions = await repos.exams.listQuestions(exam.id);
    const wrongWordIds: string[] = [];
    for (const [index, question] of questions.entries()) {
      const wrong = index < wrongCount;
      if (wrong) wrongWordIds.push(question.wordId);
      await answerQuizQuestion(
        deps,
        {
          examId: exam.id,
          questionId: question.id,
          answer: wrong ? wrongAnswerFor(question) : correctAnswerFor(question),
        },
        NOW,
      );
    }
    await finishQuiz(deps, exam.id, NOW);
    return { examId: exam.id, wrongWordIds };
  }

  it("re-tests only the missed words, as type 'pratica' linked to the origin", async () => {
    const { examId, wrongWordIds } = await aFinishedQuiz(2);

    const practice = await startPracticeQuiz(deps, examId, opts, NOW);

    expect(practice.type).toBe("pratica");
    expect(practice.status).toBe("em_andamento");
    expect(practice.practiceOfId).toBe(examId);

    const questions = await repos.exams.listQuestions(practice.id);
    expect(questions).toHaveLength(wrongWordIds.length);
    expect(new Set(questions.map((q) => q.wordId))).toEqual(
      new Set(wrongWordIds),
    );
  });

  it("rejects when the finished quiz has no mistakes", async () => {
    const { examId } = await aFinishedQuiz(0);
    await expect(startPracticeQuiz(deps, examId, opts, NOW)).rejects.toThrow(
      /Nenhum erro para praticar/,
    );
  });

  it("rejects an origin that is not 'finalizada'", async () => {
    await seedGlossary();
    const open = await startWeeklyQuiz(deps, opts, NOW);
    await expect(startPracticeQuiz(deps, open.id, opts, NOW)).rejects.toThrow(
      /finalizada/,
    );
  });
});

describe("generateQuizWithAi (the AI writes the quiz; the app validates it)", () => {
  const words: QuizWordInput[] = Array.from({ length: 4 }, (_, i) => ({
    id: `w${i}`,
    term: `term${i}`,
    kind: "palavra" as const,
    definitionEn: `en meaning ${i}`,
    definitionPt: `pt significado ${i}`,
    observations: [],
    contextSentences: i === 0 ? [`A sentence with term${i}.`] : [],
  }));

  it("returns one multiple-choice question per word, all ai_context", async () => {
    const questions = await generateQuizWithAi(aiProvider, words, SEED);

    expect(questions).toHaveLength(words.length);
    expect(new Set(questions.map((q) => q.wordId)).size).toBe(words.length);
    for (const q of questions) {
      expect(q.type).toBe("ai_context");
      expect(q.options).toHaveLength(4);
      expect(q.correctAnswer).toBeNull();
      // correctIndex still points at the AI's correct option after reshuffle.
      expect(q.options?.[q.correctIndex ?? -1]).toMatch(/^pt /);
      expect(q.explanation).not.toBeNull();
    }
    expect(questions.map((q) => q.position)).toEqual([0, 1, 2, 3]);
  });

  it("retries once on an unparseable reply, then succeeds", async () => {
    let calls = 0;
    const flaky: AiProvider = {
      name: "flaky",
      complete: async (prompt) => {
        calls += 1;
        return calls === 1 ? "desculpe, não consegui" : itemsForPrompt(prompt);
      },
    };
    const questions = await generateQuizWithAi(flaky, words, SEED);
    expect(calls).toBe(2);
    expect(questions).toHaveLength(words.length);
  });

  it("throws a friendly error after two invalid replies", async () => {
    const bad: AiProvider = { name: "bad", complete: async () => "not json" };
    await expect(generateQuizWithAi(bad, words, SEED)).rejects.toThrow(
      AI_QUIZ_FAILED_MESSAGE,
    );
  });

  it("drops items whose term matches no word or whose options are dishonest", async () => {
    const messy: AiProvider = {
      name: "messy",
      complete: async () =>
        JSON.stringify({
          items: [
            // matches term0 — kept
            {
              term: "term0",
              prompt: "?",
              options: ["a", "b", "c", "d"],
              optionExplanations: ["a certa", "b errada", "c errada", "d errada"],
              correctIndex: 0,
              explanation: "ok",
            },
            // duplicate options — dropped
            {
              term: "term1",
              prompt: "?",
              options: ["x", "x", "y", "z"],
              optionExplanations: ["x certa", "x errada", "y errada", "z errada"],
              correctIndex: 0,
              explanation: "dup",
            },
            // unknown term — dropped
            {
              term: "ghost",
              prompt: "?",
              options: ["a", "b", "c", "d"],
              optionExplanations: ["a certa", "b errada", "c errada", "d errada"],
              correctIndex: 0,
              explanation: "ghost",
            },
          ],
        }),
    };
    const questions = await generateQuizWithAi(messy, words, SEED);
    expect(questions).toHaveLength(1);
    expect(questions[0]?.wordId).toBe("w0");
  });

  it("throws after the timeout when the provider hangs", async () => {
    vi.useFakeTimers();
    try {
      const hang: AiProvider = {
        name: "hang",
        complete: () => new Promise<string>(() => {}),
      };
      const promise = generateQuizWithAi(hang, words, SEED);
      const assertion = expect(promise).rejects.toThrow();
      // Two attempts, each racing a 90s timeout.
      await vi.advanceTimersByTimeAsync(90_000);
      await vi.advanceTimersByTimeAsync(90_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
