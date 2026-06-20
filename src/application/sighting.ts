/**
 * Per-sighting (word-in-a-source) use cases. A sighting can carry its own
 * source-specific meaning — EN/PT definitions and examples — separate from the
 * word's general definition, plus the real context sentence.
 */

import type {
  SourceRepository,
  WordRepository,
  WordSighting,
  WordSightingRepository,
} from "../domain/index.js";
import type { EditSightingInput, SightingDetail } from "./dto.js";

export async function getSightingDetail(
  deps: {
    sightings: WordSightingRepository;
    words: WordRepository;
    sources: SourceRepository;
  },
  sightingId: string,
): Promise<SightingDetail | null> {
  const sighting = await deps.sightings.findById(sightingId);
  if (!sighting) return null;
  const [word, source] = await Promise.all([
    deps.words.findById(sighting.wordId),
    deps.sources.findById(sighting.sourceId),
  ]);
  return { sighting, word, source };
}

export async function updateSighting(
  sightings: WordSightingRepository,
  sightingId: string,
  input: EditSightingInput,
): Promise<WordSighting> {
  const existing = await sightings.findById(sightingId);
  if (!existing) throw new Error(`Encontro inexistente: ${sightingId}`);
  return sightings.update(sightingId, input);
}
