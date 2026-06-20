import type { PrismaClient } from "@prisma/client";
import type { Word, WordSighting } from "../../domain/model.js";
import type {
  NewSighting,
  NewWord,
  SrsUpdate,
  WordRepository,
} from "../../domain/ports/repositories.js";
import { toWord, toWordSighting } from "./mappers.js";

export class PrismaWordRepository implements WordRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: NewWord): Promise<Word> {
    const row = await this.prisma.word.create({
      data: {
        term: data.term,
        termKey: data.term.toLowerCase(),
        definitionEn: data.definitionEn,
        definitionPt: data.definitionPt,
        examples: JSON.stringify(data.examples),
        nextReview: data.nextReview,
        ...(data.createdAt ? { createdAt: data.createdAt } : {}),
      },
    });
    return toWord(row);
  }

  async findById(id: string): Promise<Word | null> {
    const row = await this.prisma.word.findUnique({ where: { id } });
    return row ? toWord(row) : null;
  }

  async findByTerm(term: string): Promise<Word | null> {
    const row = await this.prisma.word.findUnique({
      where: { termKey: term.toLowerCase() },
    });
    return row ? toWord(row) : null;
  }

  async listDueForReview(now: Date): Promise<Word[]> {
    const rows = await this.prisma.word.findMany({
      where: { nextReview: { lte: now } },
      orderBy: { nextReview: "asc" },
    });
    return rows.map(toWord);
  }

  async updateSrs(id: string, srs: SrsUpdate): Promise<Word> {
    const row = await this.prisma.word.update({
      where: { id },
      data: {
        easeFactor: srs.easeFactor,
        intervalDays: srs.intervalDays,
        repetitions: srs.repetitions,
        nextReview: srs.nextReview,
      },
    });
    return toWord(row);
  }

  async recordSighting(
    wordId: string,
    sighting: NewSighting,
  ): Promise<WordSighting> {
    const row = await this.prisma.wordSighting.create({
      data: {
        wordId,
        sourceId: sighting.sourceId,
        seenAt: sighting.seenAt,
        contextSentence: sighting.contextSentence ?? null,
        isFirstEncounter: sighting.isFirstEncounter,
      },
    });
    return toWordSighting(row);
  }
}
