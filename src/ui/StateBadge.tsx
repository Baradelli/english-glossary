import type { ReactNode } from "react";
import type { WordState } from "../domain/index.js";

const styles: Record<WordState, string> = {
  nova: "bg-sky-100 text-sky-800",
  aprendendo: "bg-amber-100 text-amber-800",
  dominada: "bg-emerald-100 text-emerald-800",
};

/** Small pill showing a word's derived SRS state (§6.1). */
export function StateBadge({ state }: { state: WordState }): ReactNode {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[state]}`}
    >
      {state}
    </span>
  );
}
