import type { PrismaClient } from "@prisma/client";
import type {
  Exam,
  ExamQuestion,
  ExamType,
  ExamWord,
} from "../../domain/model.js";
import type {
  ExamCorrection,
  ExamRepository,
  FinishQuizData,
  NewExam,
  NewQuizExam,
  QuestionAnswer,
} from "../../domain/ports/repositories.js";
import { toExam, toExamQuestion, toExamWord } from "./mappers.js";

export class PrismaExamRepository implements ExamRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: NewExam): Promise<Exam> {
    const row = await this.prisma.exam.create({
      data: {
        type: data.type,
        sourceId: data.sourceId ?? null,
        status: "gerada",
        promptText: data.promptText,
        ...(data.createdAt ? { createdAt: data.createdAt } : {}),
      },
    });
    return toExam(row);
  }

  async findById(id: string): Promise<Exam | null> {
    const row = await this.prisma.exam.findUnique({ where: { id } });
    return row ? toExam(row) : null;
  }

  async listAll(): Promise<Exam[]> {
    const rows = await this.prisma.exam.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toExam);
  }

  async saveAnswers(
    examId: string,
    data: { answersText: string; correctionPrompt: string },
  ): Promise<Exam> {
    const row = await this.prisma.exam.update({
      where: { id: examId },
      data: {
        answersText: data.answersText,
        correctionPrompt: data.correctionPrompt,
        status: "respondida",
      },
    });
    return toExam(row);
  }

  async submitCorrection(
    examId: string,
    correction: ExamCorrection,
  ): Promise<Exam> {
    const row = await this.prisma.$transaction(async (tx) => {
      const exam = await tx.exam.update({
        where: { id: examId },
        data: {
          status: "corrigida",
          resultJson: JSON.stringify(correction.resultJson),
          score: correction.score,
        },
      });

      for (const word of correction.words) {
        await tx.examWord.create({
          data: { examId, wordId: word.wordId, correct: word.correct },
        });
        await tx.word.update({
          where: { id: word.wordId },
          data: {
            easeFactor: word.srs.easeFactor,
            intervalDays: word.srs.intervalDays,
            repetitions: word.srs.repetitions,
            nextReview: word.srs.nextReview,
          },
        });
        await tx.reviewLog.create({
          data: {
            wordId: word.wordId,
            quality: word.reviewLog.quality,
            reviewedAt: word.reviewLog.reviewedAt,
            intervalDays: word.srs.intervalDays,
          },
        });
      }

      return exam;
    });

    return toExam(row);
  }

  async createQuiz(data: NewQuizExam): Promise<Exam> {
    // Nested create = one implicit transaction: the exam and every question
    // land together or not at all (a quiz never exists half-built).
    const row = await this.prisma.exam.create({
      data: {
        type: data.type,
        status: "em_andamento",
        promptText: "", // quizzes have no copy-paste prompt
        practiceOfId: data.practiceOfId ?? null,
        ...(data.createdAt ? { createdAt: data.createdAt } : {}),
        questions: {
          create: data.questions.map((q) => ({
            wordId: q.wordId,
            position: q.position,
            type: q.type,
            prompt: q.prompt,
            options: q.options === null ? null : JSON.stringify(q.options),
            correctIndex: q.correctIndex,
            correctAnswer: q.correctAnswer,
            contextSentence: q.contextSentence,
            explanation: q.explanation,
            optionExplanations:
              q.optionExplanations === null
                ? null
                : JSON.stringify(q.optionExplanations),
          })),
        },
      },
    });
    return toExam(row);
  }

  async listQuestions(examId: string): Promise<ExamQuestion[]> {
    const rows = await this.prisma.examQuestion.findMany({
      where: { examId },
      orderBy: { position: "asc" },
    });
    return rows.map(toExamQuestion);
  }

  async findQuestionById(id: string): Promise<ExamQuestion | null> {
    const row = await this.prisma.examQuestion.findUnique({ where: { id } });
    return row ? toExamQuestion(row) : null;
  }

  async answerQuestion(
    questionId: string,
    data: QuestionAnswer,
  ): Promise<ExamQuestion> {
    // Conditional updateMany: only an unanswered question takes the write, so
    // a double-click or a stale tab can never overwrite the first answer.
    const { count } = await this.prisma.examQuestion.updateMany({
      where: { id: questionId, answeredAt: null },
      data: {
        userAnswer: data.userAnswer,
        isCorrect: data.isCorrect,
        answeredAt: data.answeredAt,
      },
    });
    if (count === 0) throw new Error("Questão já respondida.");
    const row = await this.prisma.examQuestion.findUniqueOrThrow({
      where: { id: questionId },
    });
    return toExamQuestion(row);
  }

  async findInProgressByType(type: ExamType): Promise<Exam | null> {
    const row = await this.prisma.exam.findFirst({
      where: { type, status: "em_andamento" },
      orderBy: { createdAt: "desc" },
    });
    return row ? toExam(row) : null;
  }

  async finishQuiz(examId: string, data: FinishQuizData): Promise<Exam> {
    const row = await this.prisma.$transaction(async (tx) => {
      // Conditional updateMany guards against a double close: only a quiz
      // still 'em_andamento' transitions, anything else aborts the whole
      // transaction.
      const { count } = await tx.exam.updateMany({
        where: { id: examId, status: "em_andamento" },
        data: {
          status: "finalizada",
          score: data.score,
          finishedAt: data.finishedAt,
        },
      });
      if (count === 0) {
        throw new Error("Prova não está em andamento — nada foi alterado.");
      }

      for (const word of data.words) {
        await tx.examWord.create({
          data: { examId, wordId: word.wordId, correct: word.correct },
        });
        await tx.word.update({
          where: { id: word.wordId },
          data: {
            easeFactor: word.srs.easeFactor,
            intervalDays: word.srs.intervalDays,
            repetitions: word.srs.repetitions,
            nextReview: word.srs.nextReview,
          },
        });
        await tx.reviewLog.create({
          data: {
            wordId: word.wordId,
            quality: word.reviewLog.quality,
            reviewedAt: word.reviewLog.reviewedAt,
            intervalDays: word.srs.intervalDays,
          },
        });
      }

      return tx.exam.findUniqueOrThrow({ where: { id: examId } });
    });

    return toExam(row);
  }

  async listWordResults(): Promise<ExamWord[]> {
    const rows = await this.prisma.examWord.findMany();
    return rows.map(toExamWord);
  }
}
