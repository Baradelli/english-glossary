/**
 * Per-source view (Fluxo A2): what I learned in a source, splitting words
 * registered there (new) from words I already knew and re-encountered. The
 * split mirrors the sightings' isFirstEncounter flag.
 */

import type {
  SourceRepository,
  SourceTypeRepository,
  WordRepository,
  WordSightingRepository,
} from "../domain/index.js";
import type { SourceDetail, SourceWordView } from "./dto.js";

interface SourceViewDeps {
  readonly sources: SourceRepository;
  readonly sourceTypes: SourceTypeRepository;
  readonly sightings: WordSightingRepository;
  readonly words: WordRepository;
}

export async function getSourceDetail(
  deps: SourceViewDeps,
  sourceId: string,
): Promise<SourceDetail | null> {
  const source = await deps.sources.findById(sourceId);
  if (!source) return null;

  const sourceType = await deps.sourceTypes.findById(source.sourceTypeId);
  const sightings = await deps.sightings.listBySource(sourceId);

  const newWords: SourceWordView[] = [];
  const reencounters: SourceWordView[] = [];

  for (const sighting of sightings) {
    const word = await deps.words.findById(sighting.wordId);
    if (!word) continue; // defensive: skip dangling sightings
    const view: SourceWordView = {
      word,
      seenAt: sighting.seenAt,
      contextSentence: sighting.contextSentence,
    };
    (sighting.isFirstEncounter ? newWords : reencounters).push(view);
  }

  return {
    source,
    sourceType,
    newWords,
    reencounters,
    totalWords: newWords.length + reencounters.length,
  };
}
