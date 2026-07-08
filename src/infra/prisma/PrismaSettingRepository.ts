import type { PrismaClient } from "@prisma/client";
import type { SettingsRepository } from "../../domain/ports/repositories.js";

export class PrismaSettingRepository implements SettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async get(key: string): Promise<string | null> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return row ? row.value : null;
  }

  async getMany(keys: readonly string[]): Promise<Record<string, string>> {
    const rows = await this.prisma.setting.findMany({
      where: { key: { in: [...keys] } },
    });
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  async set(key: string, value: string): Promise<void> {
    await this.prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  async delete(key: string): Promise<void> {
    await this.prisma.setting.deleteMany({ where: { key } });
  }
}
