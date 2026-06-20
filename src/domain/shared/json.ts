/**
 * Extracts the JSON payload from an LLM response. Models frequently wrap JSON
 * in a markdown code fence (```json … ```) or add a sentence around it, which
 * breaks JSON.parse. This pulls out the fenced block when present, otherwise
 * slices to the outermost {...}/[...] when the text is surrounded by prose.
 * Returns the trimmed input unchanged when it already looks like bare JSON.
 */
export function extractJsonText(raw: string): string {
  const trimmed = raw.trim();

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence && fence[1] ? fence[1].trim() : trimmed;

  if (candidate.startsWith("{") || candidate.startsWith("[")) {
    return candidate;
  }

  // Surrounding prose with no fence: slice to the outermost braces/brackets.
  const start = candidate.search(/[{[]/);
  const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
  if (start !== -1 && end > start) {
    return candidate.slice(start, end + 1);
  }
  return candidate;
}
