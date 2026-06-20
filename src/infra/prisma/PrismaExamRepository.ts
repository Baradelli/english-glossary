import type { PrismaClient } from "@prisma/client";
import type { Exam } from "../../domain/model.js";
import type {
  ExamCorrection,
  ExamRepository,
  NewExam,
} from "../../domain/ports/repositories.js";
import { toExam } from "./mappers.js";

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
}
