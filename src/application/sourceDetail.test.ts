import { beforeEach, describe, expect, it } from "vitest";
import { getTestPrisma, resetDb } from "../../test/helpers/db.js";
import { createRepositories } from "../infra/prisma/repositories.js";
import { ensureSource, ensureSourceType } from "./sources.js";
import { recordReencounter, registerNewWord } from "./words.js";
import { getSourceDetail } from "./sourceDetail.js";
import type { RegisterNewWordInput } from "./dto.js";

const repos = createRepositories(getTestPrisma());
const NOW = new Date("2026-06-19T00:00:00.000Z");

const viewDeps = {
  sources: repos.sources,
  sourceTypes: repos.sourceTypes,
  sightings: repos.sightings,
  words: repos.words,
};

function input(overrides: Partial<RegisterNewWordInput>): RegisterNewWordInput {
  return {
    term: "ramble",
    definitionEn: "x",
    definitionPt: "y",
    examples: ["e"],
    sourceId: "",
    ...overrides,
  };
}

beforeEach(resetDb);

describe("getSourceDetail", () => {
  it("returns null for an unknown source", async () => {
    expect(await getSourceDetail(viewDeps, "ghost")).toBeNull();
  });

  it("separates words registered here (new) from re-encounters", async () => {
    const typeId = (await ensureSourceType(repos.sourceTypes, "Vídeo")).id;
    const here = (
      await ensureSource(repos.sources, {
        name: "Fireship",
        sourceTypeId: typeId,
      })
    ).id;
    const elsewhere = (
      await ensureSource(repos.sources, { name: "Other", sourceTypeId: typeId })
    ).id;

    // "ramble" is registered (first encounter) in this source.
    await registerNewWord(repos.words, input({ term: "ramble", sourceId: here }), NOW);

    // "rambling" was registered elsewhere, then re-encountered here.
    const { word: rambling } = await registerNewWord(
      repos.words,
      input({ term: "rambling", sourceId: elsewhere }),
      NOW,
    );
    await recordReencounter(
      { words: repos.words, sightings: repos.sightings },
      { wordId: rambling.id, sourceId: here, contextSentence: "seen again" },
      NOW,
    );

    const detail = await getSourceDetail(viewDeps, here);
    expect(detail?.source.name).toBe("Fireship");
    expect(detail?.sourceType?.name).toBe("Vídeo");
    expect(detail?.newWords.map((w) => w.word.term)).toEqual(["ramble"]);
    expect(detail?.reencounters.map((w) => w.word.term)).toEqual(["rambling"]);
    expect(detail?.totalWords).toBe(2);
  });
});
