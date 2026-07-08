import type { ReactNode } from "react";
import Link from "next/link";
import { repos } from "../../../src/server/container.js";
import { NewSourceForm } from "../../../src/ui/SourceForms.js";
import { cardClass } from "../../../src/ui/controls.js";

export const dynamic = "force-dynamic";

export default async function NewSourcePage(): Promise<ReactNode> {
  const types = await repos.sourceTypes.list();
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Nova fonte</h1>
      <div className={cardClass}>
        <NewSourceForm types={types} />
      </div>
      <Link href="/sources" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        ← Voltar às fontes
      </Link>
    </div>
  );
}
