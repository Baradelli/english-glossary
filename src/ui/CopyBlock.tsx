"use client";

import { useState, type ReactNode } from "react";

/** A read-only prompt block with a copy-to-clipboard button (Manual mode UX). */
export function CopyBlock({ text }: { text: string }): ReactNode {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 rounded-md bg-slate-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-600"
      >
        {copied ? "Copiado!" : "Copiar"}
      </button>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 pr-20 text-sm dark:border-slate-800 dark:bg-slate-800">
        {text}
      </pre>
    </div>
  );
}
