/**
 * Capture-flow use cases for sources and their types (Fluxo A). "Ensure"
 * functions are idempotent find-or-create: a type is deduped by name
 * (case-insensitive), a source by URL when one is present. This is where the
 * "no duplicate source/type" acceptance criteria (§3) live.
 */

import type {
  Source,
  SourceRepository,
  SourceType,
  SourceTypeRepository,
} from "../domain/index.js";
import type { EnsureSourceInput } from "./dto.js";

export async function ensureSourceType(
  sourceTypes: SourceTypeRepository,
  name: string,
): Promise<SourceType> {
  const existing = await sourceTypes.findByName(name);
  return existing ?? (await sourceTypes.create(name));
}

export async function ensureSource(
  sources: SourceRepository,
  input: EnsureSourceInput,
): Promise<Source> {
  if (input.url) {
    const existing = await sources.findByUrl(input.url);
    if (existing) return existing;
  }
  return sources.create({
    name: input.name,
    url: input.url ?? null,
    sourceTypeId: input.sourceTypeId,
  });
}

export async function listSources(
  sources: SourceRepository,
  sourceTypeId?: string,
): Promise<Source[]> {
  return sourceTypeId ? sources.listByType(sourceTypeId) : sources.list();
}
