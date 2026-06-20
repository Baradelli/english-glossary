import { beforeEach, describe, expect, it } from "vitest";
import { getTestPrisma, resetDb } from "../../test/helpers/db.js";
import { createRepositories } from "../infra/prisma/repositories.js";
import { ensureSource, ensureSourceType } from "./sources.js";
import {
  captureInSource,
  getWordDetail,
  listGlossary,
  recordReencounter,
  registerNewWord,
  searchWord,
} from "./words.js";
import type { RegisterNewWordInput } from "./dto.js";

const repos = createRepositories(getTestPrisma());
const NOW = new Date("2026-06-19T00:00:00.000Z");
const wordDeps = {
  words: repos.words,
  sightings: repos.sightings,
  sources: repos.sources,
};

async function aSource(name = "Fireship"): Promise<string> {
  const sourceTypeId = (await ensureSourceType(repos.sourceTypes, "Vídeo")).id;
  return (await ensureSource(repos.sources, { name, sourceTypeId })).id;
}

function input(overrides: Partial<RegisterNewWordInput> = {}): RegisterNewWordInput {
  return {
    term: "ramble",
    definitionEn: "to talk at length",
    definitionPt: "divagar",
    examples: ["I tend to ramble."],
    sourceId: "",
    contextSentence: "Sorry, I ramble.",
    ...overrides,
  };
}

beforeEach(resetDb);

describe("registerNewWord", () => {
  it("creates the word due immediately and a first-encounter sighting", async () => {
    const sourceId = await aSource();
    const { word, sighting } = await registerNewWord(
      repos.words,
      input({ sourceId }),
      NOW,
    );
    expect(word.term).toBe("ramble");
    expect(word.repetitions).toBe(0);
    expect(word.nextReview.toISOString()).toBe(NOW.toISOString());
    expect(sighting.isFirstEncounter).toBe(true);
    expect(sighting.contextSentence).toBe("Sorry, I ramble.");
  });

  it("allows registering without a context sentence", async () => {
    const sourceId = await aSource();
    const { sighting } = await registerNewWord(
      repos.words,
      input({ sourceId, contextSentence: null }),
      NOW,
    );
    expect(sighting.contextSentence).toBeNull();
  });

  it("requires a term, both definitions and at least one example (§3)", async () => {
    const sourceId = await aSource();
    await expect(
      registerNewWord(repos.words, input({ sourceId, term: "  " }), NOW),
    ).rejects.toThrow();
    await expect(
      registerNewWord(repos.words, input({ sourceId, examples: [] }), NOW),
    ).rejects.toThrow();
    await expect(
      registerNewWord(repos.words, input({ sourceId, definitionPt: "" }), NOW),
    ).rejects.toThrow();
  });
});

describe("searchWord", () => {
  it("returns null when the term does not exist (UI opens the register flow)", async () => {
    expect(await searchWord(wordDeps, "ghost")).toBeNull();
  });

  it("returns the word detail with its sighting sources when it exists", async () => {
    const sourceId = await aSource("Fireship");
    await registerNewWord(repos.words, input({ sourceId }), NOW);

    const detail = await searchWord(wordDeps, "Ramble"); // case-insensitive
    expect(detail?.word.term).toBe("ramble");
    expect(detail?.state).toBe("nova");
    expect(detail?.sightings).toHaveLength(1);
    expect(detail?.sightings[0]?.sourceName).toBe("Fireship");
    expect(detail?.sightings[0]?.isFirstEncounter).toBe(true);
  });
});

describe("getWordDetail", () => {
  it("returns null for an unknown word id", async () => {
    expect(await getWordDetail(wordDeps, "ghost")).toBeNull();
  });
});

describe("recordReencounter", () => {
  it("adds a re-encounter sighting to an existing word in a new source", async () => {
    const firstSource = await aSource("Fireship");
    const { word } = await registerNewWord(
      repos.words,
      input({ sourceId: firstSource }),
      NOW,
    );
    const secondSource = await aSource("Some Movie");

    await recordReencounter(
      { words: repos.words, sightings: repos.sightings },
      { wordId: word.id, sourceId: secondSource, contextSentence: "again" },
      NOW,
    );

    const detail = await getWordDetail(wordDeps, word.id);
    expect(detail?.sightings).toHaveLength(2);
    const second = detail?.sightings.find((s) => s.sourceName === "Some Movie");
    expect(second?.isFirstEncounter).toBe(false);
  });

  it("records a re-encounter without a context sentence", async () => {
    const firstSource = await aSource("Fireship");
    const { word } = await registerNewWord(
      repos.words,
      input({ sourceId: firstSource }),
      NOW,
    );
    const secondSource = await aSource("Movie");
    const sighting = await recordReencounter(
      { words: repos.words, sightings: repos.sightings },
      { wordId: word.id, sourceId: secondSource },
      NOW,
    );
    expect(sighting.contextSentence).toBeNull();
  });

  it("refuses to record a re-encounter for a non-existent word", async () => {
    const sourceId = await aSource();
    await expect(
      recordReencounter(
        { words: repos.words, sightings: repos.sightings },
        { wordId: "ghost", sourceId },
        NOW,
      ),
    ).rejects.toThrow();
  });
});

describe("captureInSource (batch capture from a source page)", () => {
  const captureDeps = () => ({ words: repos.words, sightings: repos.sightings });

  it("creates a brand-new word with a first encounter", async () => {
    const sourceId = await aSource();
    const { word, created } = await captureInSource(
      captureDeps(),
      {
        sourceId,
        term: "ramble",
        definitionEn: "to talk at length",
        definitionPt: "divagar",
        examples: ["I ramble."],
        contextSentence: "here",
      },
      NOW,
    );
    expect(created).toBe(true);
    expect(word.term).toBe("ramble");
    const detail = await getWordDetail(wordDeps, word.id);
    expect(detail?.sightings).toHaveLength(1);
  });

  it("records a re-encounter when the term already exists (no duplicate)", async () => {
    const first = await aSource("Fireship");
    await registerNewWord(repos.words, input({ sourceId: first }), NOW);
    const second = await aSource("Movie");

    const { word, created } = await captureInSource(
      captureDeps(),
      { sourceId: second, term: "Ramble", contextSentence: "seen again" },
      NOW,
    );
    expect(created).toBe(false);
    expect((await listGlossary(repos.words)).filter((w) => w.term === "ramble"))
      .toHaveLength(1);
    const detail = await getWordDetail(wordDeps, word.id);
    expect(detail?.sightings).toHaveLength(2);
  });

  it("records a re-encounter even without a context sentence", async () => {
    const first = await aSource("Fireship");
    await registerNewWord(repos.words, input({ sourceId: first }), NOW);
    const second = await aSource("Movie");
    const { created } = await captureInSource(
      captureDeps(),
      { sourceId: second, term: "ramble" },
      NOW,
    );
    expect(created).toBe(false);
  });

  it("rejects a new term without the required definitions", async () => {
    const sourceId = await aSource();
    await expect(
      captureInSource(captureDeps(), { sourceId, term: "brandnew" }, NOW),
    ).rejects.toThrow();
  });
});

describe("listGlossary", () => {
  it("lists all words", async () => {
    const sourceId = await aSource();
    await registerNewWord(repos.words, input({ sourceId, term: "ramble" }), NOW);
    await registerNewWord(repos.words, input({ sourceId, term: "abate" }), NOW);
    expect((await listGlossary(repos.words)).map((w) => w.term)).toEqual([
      "abate",
      "ramble",
    ]);
  });
});
