import type { ReactNode } from "react";
import Link from "next/link";
import { getReviewQueue } from "../../src/application/index.js";
import { repos } from "../../src/server/container.js";
import { ReviewCard } from "../../src/ui/ReviewCard.js";

export const dynamic = "force-dynamic";

export default async function ReviewPage(): Promise<ReactNode> {
  const queue = await getReviewQueue(repos.words, new Date());

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Revisão</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {queue.length} {queue.length === 1 ? "palavra" : "palavras"} para hoje.
        </p>
      </header>

      {queue.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-slate-600 dark:text-slate-400">Nada para revisar agora. 🎉</p>
          <Link
            href="/glossary"
            className="mt-2 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            Ver o glossário
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {queue.map((word) => (
            <ReviewCard
              key={word.id}
              word={{
                id: word.id,
                term: word.term,
                definitionEn: word.definitionEn,
                definitionPt: word.definitionPt,
                examples: word.examples,
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
