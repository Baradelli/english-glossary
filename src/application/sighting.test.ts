import { beforeEach, describe, expect, it } from "vitest";
import { getTestPrisma, resetDb } from "../../test/helpers/db.js";
import { createRepositories } from "../infra/prisma/repositories.js";
import { ensureSource, ensureSourceType } from "./sources.js";
import { registerNewWord } from "./words.js";
import { getSightingDetail, updateSighting } from "./sighting.js";

const repos = createRepositories(getTestPrisma());
const NOW = new Date("2026-06-19T00:00:00.000Z");
const deps = {
  sightings: repos.sightings,
  words: repos.words,
  sources: repos.sources,
};

async function aSightingId(): Promise<string> {
  const typeId = (await ensureSourceType(repos.sourceTypes, "Vídeo")).id;
  const sourceId = (
    await ensureSource(repos.sources, { name: "Fireship", sourceTypeId: typeId })
  ).id;
  const { sighting } = await repos.words.createWithFirstSighting(
    {
      term: "ramble",
      definitionEn: "geral EN",
      definitionPt: "geral PT",
      examples: [],
      nextReview: NOW,
    },
    { sourceId, seenAt: NOW },
  );
  return sighting.id;
}

beforeEach(resetDb);

describe("getSightingDetail", () => {
  it("returns null for an unknown sighting", async () => {
    expect(await getSightingDetail(deps, "ghost")).toBeNull();
  });

  it("returns the sighting with its word and source", async () => {
    const id = await aSightingId();
    const detail = await getSightingDetail(deps, id);
    expect(detail?.word?.term).toBe("ramble");
    expect(detail?.source?.name).toBe("Fireship");
    expect(detail?.sighting.definitionEn).toBeNull(); // none yet
  });
});

describe("updateSighting", () => {
  it("saves per-source definitions and examples", async () => {
    const id = await aSightingId();
    const updated = await updateSighting(repos.sightings, id, {
      definitionEn: "here it means X",
      definitionPt: "aqui significa X",
      examples: ["ex from this source"],
    });
    expect(updated.definitionEn).toBe("here it means X");
    expect(updated.examples).toEqual(["ex from this source"]);

    // The word's general definition is untouched.
    const detail = await getSightingDetail(deps, id);
    expect(detail?.word?.definitionEn).toBe("geral EN");
  });

  it("throws for an unknown sighting", async () => {
    await expect(
      updateSighting(repos.sightings, "ghost", { definitionEn: "x" }),
    ).rejects.toThrow();
  });
});
