import type { PrismaClient } from "@prisma/client";
import type { WordSighting } from "../../domain/model.js";
import type {
  NewSighting,
  UpdateSighting,
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

  async findById(id: string): Promise<WordSighting | null> {
    const row = await this.prisma.wordSighting.findUnique({ where: { id } });
    return row ? toWordSighting(row) : null;
  }

  async update(id: string, data: UpdateSighting): Promise<WordSighting> {
    // Only set the keys actually provided (omitting a key leaves it unchanged).
    // exactOptionalPropertyTypes forbids passing explicit `undefined` values.
    const row = await this.prisma.wordSighting.update({
      where: { id },
      data: {
        ...(data.contextSentence !== undefined
          ? { contextSentence: data.contextSentence }
          : {}),
        ...(data.definitionEn !== undefined
          ? { definitionEn: data.definitionEn }
          : {}),
        ...(data.definitionPt !== undefined
          ? { definitionPt: data.definitionPt }
          : {}),
        ...(data.examples !== undefined
          ? { examples: JSON.stringify(data.examples) }
          : {}),
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
