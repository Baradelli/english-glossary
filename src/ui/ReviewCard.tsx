"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { reviewWordAction } from "../server/actions.js";
import { cardClass } from "./controls.js";
import { notify } from "./lib/form.js";

const RATINGS = [
  { q: 0, label: "0 · branco", tone: "bg-red-600 hover:bg-red-700" },
  { q: 1, label: "1", tone: "bg-red-500 hover:bg-red-600" },
  { q: 2, label: "2 · errei", tone: "bg-orange-500 hover:bg-orange-600" },
  { q: 3, label: "3 · difícil", tone: "bg-amber-500 hover:bg-amber-600" },
  { q: 4, label: "4 · bom", tone: "bg-emerald-500 hover:bg-emerald-600" },
  { q: 5, label: "5 · fácil", tone: "bg-emerald-600 hover:bg-emerald-700" },
];

export interface ReviewWordVM {
  readonly id: string;
  readonly term: string;
  readonly definitionEn: string;
  readonly definitionPt: string;
  readonly examples: string[];
}

/** A flashcard: recall first, reveal the answer, then rate 0–5 (SM-2). */
export function ReviewCard({ word }: { word: ReviewWordVM }): ReactNode {
  const router = useRouter();
  const [revealed, setRevealed] = useState(false);
  const [pending, setPending] = useState<number | null>(null);

  async function rate(quality: number): Promise<void> {
    setPending(quality);
    const fd = new FormData();
    fd.set("wordId", word.id);
    fd.set("quality", String(quality));
    const result = await reviewWordAction(fd);
    setPending(null);
    if (notify(result)) router.refresh(); // word leaves today's queue
  }

  return (
    <li className={cardClass}>
      <p className="text-lg font-semibold">{word.term}</p>

      {revealed ? (
        <div className="mt-2 space-y-1 text-sm">
          <p>
            <span className="text-slate-500">EN:</span> {word.definitionEn}
          </p>
          <p>
            <span className="text-slate-500">PT:</span> {word.definitionPt}
          </p>
          {word.examples.map((example, i) => (
            <p key={i} className="italic text-slate-600">
              “{example}”
            </p>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="mt-2 text-sm font-medium text-blue-600 hover:underline"
        >
          Mostrar resposta
        </button>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {RATINGS.map((rating) => (
          <button
            key={rating.q}
            type="button"
            onClick={() => rate(rating.q)}
            disabled={!revealed || pending !== null}
            className={`rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 ${rating.tone}`}
          >
            {rating.label}
          </button>
        ))}
      </div>
    </li>
  );
}
