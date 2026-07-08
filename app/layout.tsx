import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Toaster } from "sonner";
import { getSettingsView } from "../src/application/index.js";
import { repos } from "../src/server/container.js";
import { ThemeWatcher } from "../src/ui/ThemeWatcher.js";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "English Glossary",
  description:
    "Glossário pessoal de inglês com revisão espaçada (SM-2) e provas geradas por IA.",
};

/**
 * Anti-FOUC for "sistema": runs synchronously before first paint, so a dark
 * OS preference never flashes light. Only needed client-side — "light" and
 * "dark" are already correct straight from the server (see `theme` below).
 */
const ANTI_FOUC_SCRIPT =
  '(function(){if(document.documentElement.dataset.theme==="system"&&matchMedia("(prefers-color-scheme: dark)").matches)document.documentElement.classList.add("dark")})()';

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactNode> {
  const { theme } = await getSettingsView(repos.settings);

  return (
    <html lang="pt-BR" suppressHydrationWarning className={theme === "dark" ? "dark" : undefined} data-theme={theme}>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <script dangerouslySetInnerHTML={{ __html: ANTI_FOUC_SCRIPT }} />
        <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <nav className="mx-auto flex max-w-4xl items-center gap-6 px-6 py-4">
            <Link href="/" className="font-semibold">
              English Glossary
            </Link>
            <Link
              href="/glossary"
              data-tour="nav-glossary"
              className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Glossário
            </Link>
            <Link
              href="/sources"
              data-tour="nav-sources"
              className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Fontes
            </Link>
            <Link
              href="/review"
              data-tour="nav-review"
              className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Revisão
            </Link>
            <Link
              href="/exams"
              data-tour="nav-exams"
              className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Provas
            </Link>
            <Link
              href="/settings"
              data-tour="nav-settings"
              className="ml-auto text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Configurações
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
        <Toaster richColors closeButton position="top-right" theme={theme} />
        <ThemeWatcher />
      </body>
    </html>
  );
}
