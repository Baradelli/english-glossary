import path from "node:path";
import type { ReactNode } from "react";
import { getSettingsView } from "../../src/application/index.js";
import { DEFAULT_MODEL } from "../../src/infra/ai/ApiAiProvider.js";
import { repos } from "../../src/server/container.js";
import { cardClass } from "../../src/ui/controls.js";
import {
  SettingsAiForm,
  SettingsBackupSection,
  SettingsOnboardingSection,
} from "../../src/ui/SettingsForms.js";
import { ThemeToggle } from "../../src/ui/ThemeToggle.js";

export const dynamic = "force-dynamic";

/**
 * Where the SQLite file actually lives, for display only. Mirrors how Prisma
 * itself resolves a relative `file:` DATABASE_URL: relative to the `prisma/`
 * directory next to schema.prisma, not to the process cwd.
 */
function resolveDbPath(databaseUrl: string | undefined): string {
  if (!databaseUrl || !databaseUrl.startsWith("file:")) return databaseUrl ?? "";
  const raw = databaseUrl.slice("file:".length);
  return path.isAbsolute(raw) ? raw : path.join(process.cwd(), "prisma", raw);
}

export default async function SettingsPage(): Promise<ReactNode> {
  const view = await getSettingsView(repos.settings);
  const dbPath = resolveDbPath(process.env.DATABASE_URL);
  const envKeyPresent = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold">Inteligência Artificial</h2>
        <div className="mt-4">
          <SettingsAiForm
            hasApiKey={view.hasApiKey}
            apiKeyHint={view.apiKeyHint}
            model={view.model}
            envKeyPresent={envKeyPresent}
            defaultModel={DEFAULT_MODEL}
          />
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold">Backup e restauração</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Banco de dados:{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">{dbPath}</code>
        </p>
        <div className="mt-4">
          <SettingsBackupSection />
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold">Aparência</h2>
        <div className="mt-4">
          <ThemeToggle initialTheme={view.theme} />
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            &quot;Sistema&quot; acompanha o tema do Windows.
          </p>
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold">Onboarding</h2>
        <div className="mt-4">
          <SettingsOnboardingSection />
        </div>
      </section>
    </div>
  );
}
