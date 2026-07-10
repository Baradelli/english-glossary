import type { ReactNode } from "react";
import Link from "next/link";
import type { DifficultWordView } from "../../application/dto.js";
import { KindBadge } from "../KindBadge.js";

/**
 * Top-5 ranking of the words the learner misses the most (server component,
 * plain list). Ordered by recent failed reviews — exam misses already feed
 * ReviewLog, so `examErrors` is shown as context, never added to the count.
 */

function failuresLabel(count: number): string {
  return `${count} ${count === 1 ? "falha recente" : "falhas recentes"}`;
}

function examErrorsLabel(count: number): string {
  return `${count} ${count === 1 ? "erro em prova" : "erros em prova"}`;
}

export function DifficultWordsList({
  words,
}: {
  words: DifficultWordView[];
}): ReactNode {
  if (words.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Nenhuma palavra problemática — continue assim.
      </p>
    );
  }

  return (
    <ol>
      {words.map((word, index) => (
        <li
          key={word.wordId}
          className="flex items-center gap-2 border-b border-slate-100 py-2 last:border-0 dark:border-slate-800"
        >
          <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {index + 1}
          </span>
          <Link
            href={`/glossary/${word.wordId}`}
            className="font-medium hover:underline"
          >
            {word.term}
          </Link>
          <KindBadge kind={word.kind} />
          <span className="ml-auto text-right text-xs text-slate-500 dark:text-slate-400">
            {failuresLabel(word.failedReviews)}
            {word.examErrors > 0 ? ` · ${examErrorsLabel(word.examErrors)}` : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}
