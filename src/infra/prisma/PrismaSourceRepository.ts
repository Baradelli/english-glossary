import type { PrismaClient } from "@prisma/client";
import type { Source } from "../../domain/model.js";
import type {
  NewSource,
  SourceRepository,
} from "../../domain/ports/repositories.js";
import { toSource } from "./mappers.js";

export class PrismaSourceRepository implements SourceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: NewSource): Promise<Source> {
    const row = await this.prisma.source.create({
      data: {
        name: data.name,
        url: data.url ?? null,
        sourceTypeId: data.sourceTypeId,
        ...(data.createdAt ? { createdAt: data.createdAt } : {}),
      },
    });
    return toSource(row);
  }

  async findById(id: string): Promise<Source | null> {
    const row = await this.prisma.source.findUnique({ where: { id } });
    return row ? toSource(row) : null;
  }

  async findByUrl(url: string): Promise<Source | null> {
    const row = await this.prisma.source.findUnique({ where: { url } });
    return row ? toSource(row) : null;
  }

  async list(): Promise<Source[]> {
    const rows = await this.prisma.source.findMany();
    return rows.map(toSource);
  }
}
