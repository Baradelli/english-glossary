"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { deleteSourceAction } from "../server/actions.js";
import { notify } from "./lib/form.js";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./components/alert-dialog.js";

/**
 * Deletes a source after a shadcn-style confirmation dialog. The sightings
 * recorded in this source are removed; the words stay in the glossary.
 */
export function DeleteSourceButton({
  sourceId,
}: {
  sourceId: string;
}): ReactNode {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onConfirm(): Promise<void> {
    setPending(true);
    const fd = new FormData();
    fd.set("sourceId", sourceId);
    const result = await deleteSourceAction(fd);
    setPending(false);
    if (notify(result) && result?.redirectTo) router.push(result.redirectTo);
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950">
        Excluir fonte
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir esta fonte?</AlertDialogTitle>
          <AlertDialogDescription>
            Os encontros (sightings) registrados nela serão removidos. As
            palavras permanecem no glossário.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={pending}
            className="bg-red-600 hover:bg-red-700"
          >
            {pending ? "Excluindo…" : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
