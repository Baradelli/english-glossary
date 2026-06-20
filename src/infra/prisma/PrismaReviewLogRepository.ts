import type { PrismaClient } from "@prisma/client";
import type { ReviewLog } from "../../domain/model.js";
import type {
  NewReviewLog,
  ReviewLogRepository,
} from "../../domain/ports/repositories.js";
import { toReviewLog } from "./mappers.js";

export class PrismaReviewLogRepository implements ReviewLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: NewReviewLog): Promise<ReviewLog> {
    const row = await this.prisma.reviewLog.create({
      data: {
        wordId: data.wordId,
        quality: data.quality,
        reviewedAt: data.reviewedAt,
        intervalDays: data.intervalDays,
      },
    });
    return toReviewLog(row);
  }

  async listByWord(wordId: string): Promise<ReviewLog[]> {
    const rows = await this.prisma.reviewLog.findMany({
      where: { wordId },
      orderBy: { reviewedAt: "asc" },
    });
    return rows.map(toReviewLog);
  }
}
