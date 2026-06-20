import type { PrismaClient } from "@prisma/client";
import type { SourceType } from "../../domain/model.js";
import type { SourceTypeRepository } from "../../domain/ports/repositories.js";
import { toSourceType } from "./mappers.js";

export class PrismaSourceTypeRepository implements SourceTypeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(name: string): Promise<SourceType> {
    const row = await this.prisma.sourceType.create({
      data: { name, nameKey: name.toLowerCase() },
    });
    return toSourceType(row);
  }

  async findByName(name: string): Promise<SourceType | null> {
    const row = await this.prisma.sourceType.findUnique({
      where: { nameKey: name.toLowerCase() },
    });
    return row ? toSourceType(row) : null;
  }

  async list(): Promise<SourceType[]> {
    const rows = await this.prisma.sourceType.findMany();
    return rows.map(toSourceType);
  }
}
