import type { PrismaClient } from "@prisma/client";
import type { WordSighting } from "../../domain/model.js";
import type {
  NewSighting,
  WordSightingRepository,
} from "../../domain/ports/repositories.js";
import { toWordSighting } from "./mappers.js";

export class PrismaWordSightingRepository implements WordSightingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async record(data: NewSighting): Promise<WordSighting> {
    const row = await this.prisma.wordSighting.create({
      data: {
        wordId: data.wordId,
        sourceId: data.sourceId,
        seenAt: data.seenAt,
        contextSentence: data.contextSentence ?? null,
        isFirstEncounter: data.isFirstEncounter,
      },
    });
    return toWordSighting(row);
  }

  async listByWord(wordId: string): Promise<WordSighting[]> {
    const rows = await this.prisma.wordSighting.findMany({
      where: { wordId },
      orderBy: { seenAt: "asc" },
    });
    return rows.map(toWordSighting);
  }

  async listBySource(sourceId: string): Promise<WordSighting[]> {
    const rows = await this.prisma.wordSighting.findMany({
      where: { sourceId },
      orderBy: { seenAt: "asc" },
    });
    return rows.map(toWordSighting);
  }
}
