import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

/**
 * Vitest global setup: rebuild a clean SQLite test database once per run by
 * dropping the file and applying all migrations. The DATABASE_URL is provided
 * via vitest's `test.env` (file:./test.db -> prisma/test.db).
 */
export default function setup(): void {
  const dbPath = path.join(process.cwd(), "prisma", "test.db");
  for (const file of [dbPath, `${dbPath}-journal`]) {
    if (existsSync(file)) rmSync(file);
  }
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });
}
