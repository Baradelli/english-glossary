import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "English Glossary",
  description:
    "Glossário pessoal de inglês com revisão espaçada (SM-2) e provas geradas por IA.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white">
          <nav className="mx-auto flex max-w-4xl items-center gap-6 px-6 py-4">
            <Link href="/" className="font-semibold">
              English Glossary
            </Link>
            <Link href="/glossary" className="text-sm text-slate-600 hover:text-slate-900">
              Glossário
            </Link>
            <Link href="/sources" className="text-sm text-slate-600 hover:text-slate-900">
              Fontes
            </Link>
            <Link href="/review" className="text-sm text-slate-600 hover:text-slate-900">
              Revisão
            </Link>
            <Link href="/exams" className="text-sm text-slate-600 hover:text-slate-900">
              Provas
            </Link>
            <Link
              href="/settings"
              data-tour="nav-settings"
              className="ml-auto text-sm text-slate-600 hover:text-slate-900"
            >
              Configurações
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}
