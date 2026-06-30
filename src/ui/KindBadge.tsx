import type { ReactNode } from "react";
import type { WordKind } from "../domain/index.js";

/**
 * Small pill marking an entry as a fixed expression (ADR-005). Renders nothing
 * for a plain word, so a mixed list stays uncluttered — only expressions are
 * called out.
 */
export function KindBadge({ kind }: { kind: WordKind }): ReactNode {
  if (kind !== "expressao") return null;
  return (
    <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-800">
      expressão
    </span>
  );
}
