import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The runner is pure CommonJS (it ships inside the Electron standalone bundle).
// Load it through createRequire so `tsc` never tries to type-check the .cjs and
// we still exercise the exact file that gets copied into production.
const requireCjs = createRequire(import.meta.url);
const { runMigrations } = requireCjs("../electron/server/migrate.cjs") as {
  runMigrations: (options: {
    migrationsDir: string;
    databaseUrl: string;
  }) => Promise<{ applied: string[] }>;
};

const REAL_MIGRATIONS = path.join(process.cwd(), "prisma", "migrations");

function fileUrl(dbFile: string): string {
  return `file:${dbFile.split(path.sep).join("/")}`;
}

// The production reference: `prisma migrate deploy` against an explicit DB,
// same spawn pattern as test/global-setup.ts. Returns the CLI's stdout.
function prismaDeploy(dbFile: string): string {
  return execSync("npx prisma migrate deploy", {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: fileUrl(dbFile) },
  });
}

async function withPrisma<T>(
  dbFile: string,
  fn: (prisma: PrismaClient) => Promise<T>,
): Promise<T> {
  const prisma = new PrismaClient({
    datasources: { db: { url: fileUrl(dbFile) } },
  });
  try {
    return await fn(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

// User tables + explicit indexes, whitespace-normalised, control table removed.
async function readSchema(
  dbFile: string,
): Promise<Array<{ name: string; sql: string }>> {
  return withPrisma(dbFile, async (prisma) => {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ name: string; sql: string | null }>
    >(
      "SELECT name, sql FROM sqlite_master " +
        "WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' " +
        "AND name != '_prisma_migrations' ORDER BY name",
    );
    return rows.map((row) => ({
      name: row.name,
      sql: (row.sql ?? "").replace(/\s+/g, " ").trim(),
    }));
  });
}

async function readControl(
  dbFile: string,
): Promise<Array<{ migration_name: string; checksum: string }>> {
  return withPrisma(dbFile, (prisma) =>
    prisma.$queryRawUnsafe(
      'SELECT migration_name, checksum FROM "_prisma_migrations" ORDER BY migration_name',
    ),
  );
}

async function countRows(dbFile: string, sql: string): Promise<number> {
  return withPrisma(dbFile, async (prisma) => {
    const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint | number }>>(sql);
    const first = rows[0];
    if (!first) throw new Error("count query returned no rows");
    return Number(first.n);
  });
}

const tmpDirs: string[] = [];
function makeTmpDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "eg-migrate-"));
  tmpDirs.push(dir);
  return dir;
}

// Shared fixtures for the parity comparisons: one DB built by the runner, one
// by `prisma migrate deploy`, both from the real prisma/migrations.
let runnerDb: string;
let deployDb: string;

beforeAll(async () => {
  const dir = makeTmpDir();
  runnerDb = path.join(dir, "runner.db");
  deployDb = path.join(dir, "deploy.db");
  await runMigrations({
    migrationsDir: REAL_MIGRATIONS,
    databaseUrl: fileUrl(runnerDb),
  });
  prismaDeploy(deployDb);
}, 120_000);

afterAll(() => {
  for (const dir of tmpDirs) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch {
      // Temp directories under os.tmpdir(); the OS reclaims any stragglers.
    }
  }
});

describe("migration runner", () => {
  it("case 1 — produces a schema byte-identical to `prisma migrate deploy`", async () => {
    const [fromRunner, fromDeploy] = await Promise.all([
      readSchema(runnerDb),
      readSchema(deployDb),
    ]);
    expect(fromRunner).toEqual(fromDeploy);
    // Guard against both being empty (which would make equality meaningless).
    expect(fromRunner.map((r) => r.name)).toContain("Word");
  });

  it("case 2 — records the same (migration_name, checksum) control set", async () => {
    const [fromRunner, fromDeploy] = await Promise.all([
      readControl(runnerDb),
      readControl(deployDb),
    ]);
    expect(fromRunner).toEqual(fromDeploy);
    expect(fromRunner).toHaveLength(4);
  });

  it("case 2b (safety) — `prisma migrate deploy` treats the runner's DB as fully applied", () => {
    // The strongest compatibility proof: the real CLI reads the runner's
    // control table and re-applies nothing.
    expect(prismaDeploy(runnerDb)).toContain("No pending migrations to apply");
  }, 60_000);

  it("case 3 — re-running the runner is idempotent (no-op, control unchanged)", async () => {
    const before = (await readControl(runnerDb)).length;
    const result = await runMigrations({
      migrationsDir: REAL_MIGRATIONS,
      databaseUrl: fileUrl(runnerDb),
    });
    expect(result.applied).toEqual([]);
    expect((await readControl(runnerDb)).length).toBe(before);
  });

  it("case 4 — applies only new migrations and backs up an existing DB", async () => {
    const dir = makeTmpDir();
    const dbFile = path.join(dir, "user.db");

    // An existing user database: all real migrations already applied.
    const seeded = await runMigrations({
      migrationsDir: REAL_MIGRATIONS,
      databaseUrl: fileUrl(dbFile),
    });
    expect(seeded.applied).toHaveLength(4);

    // A migrations dir = copy of the real ones + one extra (never touch the
    // real prisma/migrations).
    const migrationsDir = path.join(dir, "migrations");
    cpSync(REAL_MIGRATIONS, migrationsDir, { recursive: true });
    const extraDir = path.join(migrationsDir, "99999999999999_smoke_extra");
    mkdirSync(extraDir);
    writeFileSync(
      path.join(extraDir, "migration.sql"),
      'CREATE TABLE "SmokeExtra" ("id" TEXT PRIMARY KEY);\n',
    );

    const controlBefore = (await readControl(dbFile)).length;
    const result = await runMigrations({
      migrationsDir,
      databaseUrl: fileUrl(dbFile),
    });

    expect(result.applied).toEqual(["99999999999999_smoke_extra"]);
    // A backup copy was written next to the DB.
    const backups = readdirSync(dir).filter((f) => f.startsWith("user.db.bak-"));
    expect(backups).toHaveLength(1);
    // The new table exists and the control table grew by exactly one row.
    expect((await readSchema(dbFile)).map((r) => r.name)).toContain("SmokeExtra");
    expect((await readControl(dbFile)).length).toBe(controlBefore + 1);
  }, 60_000);

  it("case 5 — a brand-new install applies everything and writes no backup", async () => {
    const dir = makeTmpDir();
    const dbFile = path.join(dir, "fresh.db");
    expect(existsSync(dbFile)).toBe(false);

    const result = await runMigrations({
      migrationsDir: REAL_MIGRATIONS,
      databaseUrl: fileUrl(dbFile),
    });

    expect(result.applied).toHaveLength(4);
    expect(existsSync(dbFile)).toBe(true);
    expect(readdirSync(dir).filter((f) => f.includes(".bak-"))).toEqual([]);
  });

  it("case 6 (safety) — the add_word_kind table rebuild preserves child-table rows", async () => {
    const dir = makeTmpDir();
    const dbFile = path.join(dir, "data.db");

    // Phase 1: schema state before the rebuild (init + add_sighting_definitions).
    const phase1 = path.join(dir, "phase1");
    mkdirSync(phase1);
    for (const name of [
      "20260620020513_init",
      "20260620065912_add_sighting_definitions",
    ]) {
      cpSync(path.join(REAL_MIGRATIONS, name), path.join(phase1, name), {
        recursive: true,
      });
    }
    await runMigrations({ migrationsDir: phase1, databaseUrl: fileUrl(dbFile) });

    // Seed a Word plus a WordSighting that references it (ON DELETE CASCADE).
    await withPrisma(dbFile, async (prisma) => {
      const now = Date.now();
      await prisma.$executeRawUnsafe(
        'INSERT INTO "SourceType" ("id","name","nameKey","createdAt") VALUES (?,?,?,?)',
        "st1",
        "Book",
        "book",
        now,
      );
      await prisma.$executeRawUnsafe(
        'INSERT INTO "Source" ("id","name","url","sourceTypeId","createdAt") VALUES (?,?,?,?,?)',
        "s1",
        "My Book",
        null,
        "st1",
        now,
      );
      await prisma.$executeRawUnsafe(
        'INSERT INTO "Word" ("id","term","termKey","definitionEn","definitionPt","examples","easeFactor","intervalDays","repetitions","nextReview","createdAt") VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        "w1",
        "hello",
        "hello",
        "a greeting",
        "saudação",
        "[]",
        2.5,
        0,
        0,
        now,
        now,
      );
      await prisma.$executeRawUnsafe(
        'INSERT INTO "WordSighting" ("id","wordId","sourceId","seenAt","isFirstEncounter") VALUES (?,?,?,?,?)',
        "ws1",
        "w1",
        "s1",
        now,
        1,
      );
    });

    // Phase 2: apply the remaining migrations, including the Word rebuild.
    const result = await runMigrations({
      migrationsDir: REAL_MIGRATIONS,
      databaseUrl: fileUrl(dbFile),
    });
    expect(result.applied).toEqual([
      "20260630035045_add_word_kind",
      "20260708160813_add_setting",
    ]);

    // The Word row survived the rebuild and picked up the new column's default…
    expect(await countRows(dbFile, 'SELECT COUNT(*) AS n FROM "Word"')).toBe(1);
    const kind = await withPrisma(dbFile, async (prisma) => {
      const rows = await prisma.$queryRawUnsafe<Array<{ kind: string }>>(
        'SELECT "kind" FROM "Word" WHERE "id" = ?',
        "w1",
      );
      return rows[0]?.kind;
    });
    expect(kind).toBe("palavra");
    // …and the child WordSighting was NOT cascade-deleted by DROP TABLE "Word".
    expect(await countRows(dbFile, 'SELECT COUNT(*) AS n FROM "WordSighting"')).toBe(1);
  }, 60_000);
});
