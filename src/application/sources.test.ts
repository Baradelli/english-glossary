import { beforeEach, describe, expect, it } from "vitest";
import { getTestPrisma, resetDb } from "../../test/helpers/db.js";
import { createRepositories } from "../infra/prisma/repositories.js";
import {
  deleteSource,
  ensureSource,
  ensureSourceType,
  listSources,
} from "./sources.js";

const repos = createRepositories(getTestPrisma());

beforeEach(resetDb);

describe("ensureSourceType", () => {
  it("creates a type the first time", async () => {
    const type = await ensureSourceType(repos.sourceTypes, "Vídeo");
    expect(type.name).toBe("Vídeo");
  });

  it("returns the existing type instead of duplicating (case-insensitive)", async () => {
    const first = await ensureSourceType(repos.sourceTypes, "Livro");
    const again = await ensureSourceType(repos.sourceTypes, "livro");
    expect(again.id).toBe(first.id);
    expect(await repos.sourceTypes.list()).toHaveLength(1);
  });
});

describe("ensureSource", () => {
  async function aTypeId(): Promise<string> {
    return (await ensureSourceType(repos.sourceTypes, "Vídeo")).id;
  }

  it("creates a source the first time", async () => {
    const source = await ensureSource(repos.sources, {
      name: "Fireship",
      url: "https://y/1",
      sourceTypeId: await aTypeId(),
    });
    expect(source.name).toBe("Fireship");
  });

  it("does not duplicate a source that already has the same URL", async () => {
    const sourceTypeId = await aTypeId();
    const first = await ensureSource(repos.sources, {
      name: "Fireship",
      url: "https://y/1",
      sourceTypeId,
    });
    const again = await ensureSource(repos.sources, {
      name: "Different name, same url",
      url: "https://y/1",
      sourceTypeId,
    });
    expect(again.id).toBe(first.id);
    expect(await repos.sources.list()).toHaveLength(1);
  });

  it("always creates when there is no URL (books are not deduped)", async () => {
    const sourceTypeId = await aTypeId();
    await ensureSource(repos.sources, { name: "Book A", sourceTypeId });
    await ensureSource(repos.sources, { name: "Book B", sourceTypeId });
    expect(await repos.sources.list()).toHaveLength(2);
  });
});

describe("listSources", () => {
  it("lists all sources, or filters by type", async () => {
    const video = (await ensureSourceType(repos.sourceTypes, "Vídeo")).id;
    const book = (await ensureSourceType(repos.sourceTypes, "Livro")).id;
    await ensureSource(repos.sources, { name: "V", sourceTypeId: video });
    await ensureSource(repos.sources, { name: "B", sourceTypeId: book });

    expect(await listSources(repos.sources)).toHaveLength(2);
    const onlyVideos = await listSources(repos.sources, video);
    expect(onlyVideos.map((s) => s.name)).toEqual(["V"]);
  });
});

describe("deleteSource", () => {
  it("removes the source from the list", async () => {
    const typeId = (await ensureSourceType(repos.sourceTypes, "Vídeo")).id;
    const source = await ensureSource(repos.sources, {
      name: "Errada",
      sourceTypeId: typeId,
    });
    await deleteSource(repos.sources, source.id);
    expect(await listSources(repos.sources)).toHaveLength(0);
  });
});
