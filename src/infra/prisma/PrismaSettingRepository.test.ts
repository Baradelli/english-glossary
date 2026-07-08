import { beforeEach, describe, expect, it } from "vitest";
import { getTestPrisma, resetDb } from "../../../test/helpers/db.js";
import { PrismaSettingRepository } from "./PrismaSettingRepository.js";

const repo = new PrismaSettingRepository(getTestPrisma());

beforeEach(resetDb);

describe("PrismaSettingRepository", () => {
  it("returns null for a key that doesn't exist", async () => {
    expect(await repo.get("missing")).toBeNull();
  });

  it("sets a value and reads it back", async () => {
    await repo.set("theme", "dark");
    expect(await repo.get("theme")).toBe("dark");
  });

  it("overwrites an existing key on a second set (upsert)", async () => {
    await repo.set("theme", "dark");
    await repo.set("theme", "light");
    expect(await repo.get("theme")).toBe("light");
  });

  it("getMany returns only the keys that exist", async () => {
    await repo.set("theme", "dark");
    await repo.set("locale", "pt-BR");
    const result = await repo.getMany(["theme", "locale", "missing"]);
    expect(result).toEqual({ theme: "dark", locale: "pt-BR" });
  });

  it("deletes an existing key", async () => {
    await repo.set("theme", "dark");
    await repo.delete("theme");
    expect(await repo.get("theme")).toBeNull();
  });

  it("delete of a missing key does not throw", async () => {
    await expect(repo.delete("missing")).resolves.not.toThrow();
  });
});
