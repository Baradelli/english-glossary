import type { PrismaClient } from "@prisma/client";
import { PrismaExamRepository } from "./PrismaExamRepository.js";
import { PrismaReviewLogRepository } from "./PrismaReviewLogRepository.js";
import { PrismaSourceRepository } from "./PrismaSourceRepository.js";
import { PrismaSourceTypeRepository } from "./PrismaSourceTypeRepository.js";
import { PrismaWordRepository } from "./PrismaWordRepository.js";

/** Wires every Prisma repository over a single client (composition root helper). */
export function createRepositories(prisma: PrismaClient) {
  return {
    words: new PrismaWordRepository(prisma),
    sources: new PrismaSourceRepository(prisma),
    sourceTypes: new PrismaSourceTypeRepository(prisma),
    reviewLogs: new PrismaReviewLogRepository(prisma),
    exams: new PrismaExamRepository(prisma),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
