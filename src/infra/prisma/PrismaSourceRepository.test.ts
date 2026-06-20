import { beforeEach, describe, expect, it } from "vitest";
import { getTestPrisma, resetDb } from "../../../test/helpers/db.js";
import { PrismaSourceRepository } from "./PrismaSourceRepository.js";
import { PrismaSourceTypeRepository } from "./PrismaSourceTypeRepository.js";

const types = new PrismaSourceTypeRepository(getTestPrisma());
const repo = new PrismaSourceRepository(getTestPrisma());

async function aTypeId(): Promise<string> {
  return (await types.create("Vídeo")).id;
}

beforeEach(resetDb);

describe("PrismaSourceRepository", () => {
  it("creates a source with a URL and links it to its type", async () => {
    const sourceTypeId = await aTypeId();
    const source = await repo.create({
      name: "Fireship — TS in 100s",
      url: "https://youtu.be/abc",
      sourceTypeId,
    });
    expect(source.id).toBeTruthy();
    expect(source.url).toBe("https://youtu.be/abc");
    expect(source.sourceTypeId).toBe(sourceTypeId);
  });

  it("creates a source without a URL (e.g. a book)", async () => {
    const source = await repo.create({
      name: "Some book",
      sourceTypeId: await aTypeId(),
    });
    expect(source.url).toBeNull();
  });

  it("finds a source by id", async () => {
    const created = await repo.create({
      name: "X",
      sourceTypeId: await aTypeId(),
    });
    const found = await repo.findById(created.id);
    expect(found?.name).toBe("X");
  });

  it("finds a source by URL", async () => {
    const sourceTypeId = await aTypeId();
    await repo.create({ name: "X", url: "https://a.b", sourceTypeId });
    const found = await repo.findByUrl("https://a.b");
    expect(found?.name).toBe("X");
  });

  it("rejects a duplicate URL", async () => {
    const sourceTypeId = await aTypeId();
    await repo.create({ name: "A", url: "https://dup", sourceTypeId });
    await expect(
      repo.create({ name: "B", url: "https://dup", sourceTypeId }),
    ).rejects.toThrow();
  });

  it("allows many sources without a URL (null is not deduped)", async () => {
    const sourceTypeId = await aTypeId();
    await repo.create({ name: "A", sourceTypeId });
    await expect(
      repo.create({ name: "B", sourceTypeId }),
    ).resolves.toBeTruthy();
  });

  it("lists sources", async () => {
    const sourceTypeId = await aTypeId();
    await repo.create({ name: "A", sourceTypeId });
    await repo.create({ name: "B", sourceTypeId });
    expect(await repo.list()).toHaveLength(2);
  });

  it("returns null when a source is not found", async () => {
    expect(await repo.findById("missing")).toBeNull();
    expect(await repo.findByUrl("missing")).toBeNull();
  });

  it("honours an injected createdAt", async () => {
    const createdAt = new Date("2020-01-02T03:04:05.000Z");
    const source = await repo.create({
      name: "X",
      sourceTypeId: await aTypeId(),
      createdAt,
    });
    expect(source.createdAt.toISOString()).toBe(createdAt.toISOString());
  });
});
