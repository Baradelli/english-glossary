import type { PrismaClient } from "@prisma/client";
import type { Word, WordSighting } from "../../domain/model.js";
import type {
  FirstSighting,
  NewWord,
  SrsUpdate,
  WordRepository,
} from "../../domain/ports/repositories.js";
import { toWord, toWordSighting } from "./mappers.js";

export class PrismaWordRepository implements WordRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: NewWord): Promise<Word> {
    const row = await this.prisma.word.create({ data: this.toCreateData(data) });
    return toWord(row);
  }

  async createWithFirstSighting(
    word: NewWord,
    sighting: FirstSighting,
  ): Promise<{ word: Word; sighting: WordSighting }> {
    return this.prisma.$transaction(async (tx) => {
      const wordRow = await tx.word.create({ data: this.toCreateData(word) });
      const sightingRow = await tx.wordSighting.create({
        data: {
          wordId: wordRow.id,
          sourceId: sighting.sourceId,
          seenAt: sighting.seenAt,
          contextSentence: sighting.contextSentence ?? null,
          isFirstEncounter: true,
        },
      });
      return { word: toWord(wordRow), sighting: toWordSighting(sightingRow) };
    });
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

  async listAll(): Promise<Word[]> {
    const rows = await this.prisma.word.findMany({ orderBy: { term: "asc" } });
    return rows.map(toWord);
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

  private toCreateData(data: NewWord) {
    return {
      term: data.term,
      termKey: data.term.toLowerCase(),
      definitionEn: data.definitionEn,
      definitionPt: data.definitionPt,
      examples: JSON.stringify(data.examples),
      nextReview: data.nextReview,
      ...(data.createdAt ? { createdAt: data.createdAt } : {}),
    };
  }
}
