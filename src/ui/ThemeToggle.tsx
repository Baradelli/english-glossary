"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { Theme } from "../domain/index.js";
import { saveThemeAction } from "../server/actions.js";
import { notify } from "./lib/form.js";

const THEME_OPTIONS: readonly { value: Theme; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
  { value: "system", label: "Sistema" },
];

/** Applies `mode` to the DOM immediately, before the server round trip resolves. */
function applyThemeOptimistically(mode: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = mode;
  const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
  root.classList.toggle("dark", mode === "dark" || (mode === "system" && prefersDark));
}

/**
 * Claro / Escuro / Sistema segmented control (accessible radiogroup pattern
 * copied from CaptureWordForm's Palavra/Expressão control). The click applies
 * the theme to the DOM instantly (no flash while the server action resolves),
 * persists it via {@link saveThemeAction}, then refreshes so the RSC tree
 * (and everything reading `theme` server-side, like the Toaster) picks it up.
 */
export function ThemeToggle({ initialTheme }: { initialTheme: Theme }): ReactNode {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>(initialTheme);

  async function onSelect(mode: Theme): Promise<void> {
    if (mode === theme) return;
    setTheme(mode);
    applyThemeOptimistically(mode);

    const fd = new FormData();
    fd.set("theme", mode);
    const result = await saveThemeAction(fd);
    if (!notify(result)) {
      // Roll back the optimistic DOM change on failure.
      setTheme(initialTheme);
      applyThemeOptimistically(initialTheme);
      return;
    }
    router.refresh();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="inline-flex gap-0.5 rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-800"
    >
      {THEME_OPTIONS.map((opt) => {
        const selected = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => void onSelect(opt.value)}
            className={
              "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors " +
              (selected
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
