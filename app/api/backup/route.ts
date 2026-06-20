import { exportAll } from "../../../src/infra/backup/backup.js";
import { prisma } from "../../../src/infra/prisma/client.js";

export const dynamic = "force-dynamic";

/** Downloads the whole database as a versioned JSON backup (§4). */
export async function GET(): Promise<Response> {
  const data = await exportAll(prisma);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="english-glossary-backup.json"',
    },
  });
}
