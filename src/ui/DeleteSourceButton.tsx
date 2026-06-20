"use client";

import type { ReactNode } from "react";
import { deleteSourceAction } from "../server/actions.js";

/**
 * Deletes a source after a confirmation. The sightings recorded in this source
 * are removed; the words themselves stay in the glossary.
 */
export function DeleteSourceButton({
  sourceId,
}: {
  sourceId: string;
}): ReactNode {
  return (
    <form
      action={deleteSourceAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Excluir esta fonte? Os encontros (sightings) registrados nela serão removidos. As palavras permanecem no glossário.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="sourceId" value={sourceId} />
      <button
        type="submit"
        className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        Excluir fonte
      </button>
    </form>
  );
}
