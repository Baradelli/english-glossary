/**
 * Capture-flow use cases for words (Fluxo A): search, register a new word with
 * its first sighting, record a re-encounter, list the glossary, and assemble
 * the per-word view. Dates are injected (no clock). Validation of required
 * fields (§3) lives here, before anything is persisted.
 */

import {
  deriveWordState,
  type SourceRepository,
  type Word,
  type WordRepository,
  type WordSighting,
  type WordSightingRepository,
} from "../domain/index.js";
import type {
  CaptureInSourceInput,
  RecordReencounterInput,
  RegisterNewWordInput,
  WordDetail,
  WordSightingView,
} from "./dto.js";

interface WordViewDeps {
  readonly words: WordRepository;
  readonly sightings: WordSightingRepository;
  readonly sources: SourceRepository;
}

function requireNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} é obrigatório.`);
  }
}

export async function registerNewWord(
  words: WordRepository,
  input: RegisterNewWordInput,
  now: Date,
): Promise<{ word: Word; sighting: WordSighting }> {
  requireNonEmpty(input.term, "term");
  requireNonEmpty(input.definitionEn, "definitionEn");
  requireNonEmpty(input.definitionPt, "definitionPt");
  if (input.examples.filter((e) => e.trim().length > 0).length === 0) {
    throw new Error("É necessária ao menos uma frase de exemplo autoral.");
  }

  return words.createWithFirstSighting(
    {
      term: input.term.trim(),
      definitionEn: input.definitionEn,
      definitionPt: input.definitionPt,
      examples: input.examples,
      nextReview: now, // a new word is due for review immediately
    },
    {
      sourceId: input.sourceId,
      seenAt: now,
      contextSentence: input.contextSentence ?? null,
    },
  );
}

export async function recordReencounter(
  deps: { words: WordRepository; sightings: WordSightingRepository },
  input: RecordReencounterInput,
  now: Date,
): Promise<WordSighting> {
  const word = await deps.words.findById(input.wordId);
  if (!word) {
    throw new Error(`Palavra inexistente: ${input.wordId}`);
  }
  return deps.sightings.record({
    wordId: word.id,
    sourceId: input.sourceId,
    seenAt: now,
    contextSentence: input.contextSentence ?? null,
    isFirstEncounter: false,
  });
}

/**
 * Batch-capture entry point used from a source page: if the term already
 * exists, record a re-encounter; otherwise register it as a new word. Returns
 * the word and whether it was just created.
 */
export async function captureInSource(
  deps: { words: WordRepository; sightings: WordSightingRepository },
  input: CaptureInSourceInput,
  now: Date,
): Promise<{ word: Word; created: boolean }> {
  const existing = await deps.words.findByTerm(input.term.trim());
  if (existing) {
    await recordReencounter(
      deps,
      {
        wordId: existing.id,
        sourceId: input.sourceId,
        contextSentence: input.contextSentence ?? null,
      },
      now,
    );
    return { word: existing, created: false };
  }

  const { word } = await registerNewWord(
    deps.words,
    {
      term: input.term,
      definitionEn: input.definitionEn ?? "",
      definitionPt: input.definitionPt ?? "",
      examples: input.examples ?? [],
      sourceId: input.sourceId,
      contextSentence: input.contextSentence ?? null,
    },
    now,
  );
  return { word, created: true };
}

export async function listGlossary(words: WordRepository): Promise<Word[]> {
  return words.listAll();
}

export async function searchWord(
  deps: WordViewDeps,
  term: string,
): Promise<WordDetail | null> {
  const word = await deps.words.findByTerm(term);
  return word ? buildWordDetail(deps, word) : null;
}

export async function getWordDetail(
  deps: WordViewDeps,
  wordId: string,
): Promise<WordDetail | null> {
  const word = await deps.words.findById(wordId);
  return word ? buildWordDetail(deps, word) : null;
}

async function buildWordDetail(
  deps: WordViewDeps,
  word: Word,
): Promise<WordDetail> {
  const sightings = await deps.sightings.listByWord(word.id);
  const views: WordSightingView[] = [];
  for (const sighting of sightings) {
    const source = await deps.sources.findById(sighting.sourceId);
    views.push({
      sourceId: sighting.sourceId,
      sourceName: source?.name ?? "(fonte removida)",
      seenAt: sighting.seenAt,
      contextSentence: sighting.contextSentence,
      isFirstEncounter: sighting.isFirstEncounter,
    });
  }
  return { word, state: deriveWordState(word), sightings: views };
}
