import { beforeEach, describe, expect, it } from "vitest";
import { getTestPrisma, resetDb } from "../../../test/helpers/db.js";
import { PrismaSourceTypeRepository } from "./PrismaSourceTypeRepository.js";

const repo = new PrismaSourceTypeRepository(getTestPrisma());

beforeEach(resetDb);

describe("PrismaSourceTypeRepository", () => {
  it("creates a type and returns it as a domain model", async () => {
    const type = await repo.create("Vídeo");
    expect(type.id).toBeTruthy();
    expect(type.name).toBe("Vídeo");
    expect(type.createdAt).toBeInstanceOf(Date);
  });

  it("finds a type by name, case-insensitively", async () => {
    await repo.create("Livro");
    const found = await repo.findByName("livro");
    expect(found?.name).toBe("Livro");
  });

  it("rejects a case-insensitive duplicate name (no 'livro' vs 'Livro')", async () => {
    await repo.create("Livro");
    await expect(repo.create("livro")).rejects.toThrow();
  });

  it("lists all types", async () => {
    await repo.create("Vídeo");
    await repo.create("Filme");
    const names = (await repo.list()).map((t) => t.name).sort();
    expect(names).toEqual(["Filme", "Vídeo"]);
  });

  it("returns null when a type is not found", async () => {
    expect(await repo.findByName("nope")).toBeNull();
  });
});
