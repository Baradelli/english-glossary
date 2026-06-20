"use client";

import { useRef, type ReactNode } from "react";
import { deleteSourceAction } from "../server/actions.js";
import { confirmAction } from "./dialogs.js";

/**
 * Deletes a source after a SweetAlert2 confirmation. The sightings recorded in
 * this source are removed; the words themselves stay in the glossary.
 */
export function DeleteSourceButton({
  sourceId,
}: {
  sourceId: string;
}): ReactNode {
  const formRef = useRef<HTMLFormElement>(null);

  async function handleClick(): Promise<void> {
    const confirmed = await confirmAction({
      title: "Excluir esta fonte?",
      text: "Os encontros (sightings) registrados nela serão removidos. As palavras permanecem no glossário.",
      confirmText: "Excluir",
      danger: true,
    });
    if (confirmed) formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={deleteSourceAction}>
      <input type="hidden" name="sourceId" value={sourceId} />
      <button
        type="button"
        onClick={handleClick}
        className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        Excluir fonte
      </button>
    </form>
  );
}
