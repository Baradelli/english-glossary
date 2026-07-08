"use strict";

// Migration runner for the packaged desktop app.
//
// On an end-user machine there is no Prisma CLI, so this module applies the SQL
// that `prisma migrate dev` generated under prisma/migrations/* directly to the
// user's SQLite database — first boot creates the schema, later app updates
// apply whatever is new. It records applied migrations in a control table that
// is byte-compatible with Prisma's own `_prisma_migrations`, so a database
// created here is indistinguishable from one created by `prisma migrate
// deploy`: the dev workflow (CLI) and production (this runner) share one
// migration history and neither re-applies the other's work. The parity test
// (test/migrate-runner.test.ts) is the long-term guarantee of that claim.
//
// Pure CommonJS + Node builtins only — it runs inside the Next standalone
// bundle, which Electron forks as CommonJS. `@prisma/client` is the single
// non-builtin dependency; in production it resolves inside the standalone's
// node_modules, in the repo it resolves normally.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

// Prisma's _prisma_migrations schema, verbatim. `IF NOT EXISTS` makes first
// boot create it and later boots a no-op; `prisma migrate deploy` creates the
// identical table, so the two never collide.
const CONTROL_TABLE_DDL = `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "checksum" TEXT NOT NULL,
    "finished_at" DATETIME,
    "migration_name" TEXT NOT NULL,
    "logs" TEXT,
    "rolled_back_at" DATETIME,
    "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0
);`;

// Prisma's migration checksum is the SHA-256 of the migration.sql file's raw
// bytes, hex-encoded. Hashing the Buffer (not a re-encoded string) keeps us
// byte-identical to the CLI regardless of the file's line endings.
function checksumOf(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

// Split a migration.sql into individual statements. Lines accumulate into a
// statement that ends at the first line whose trimmed text ends with ";".
// Chunks that are blank or comment-only are dropped; leading "-- ..." comment
// lines stay attached to the statement that follows them (SQLite ignores them
// when executing). The parity test proves this handles the real migrations —
// including the PRAGMA + table-rebuild in add_word_kind — byte-for-byte.
function splitStatements(sql) {
  const statements = [];
  let buffer = [];
  for (const line of sql.split(/\r?\n/)) {
    buffer.push(line);
    if (line.trim().endsWith(";")) {
      const statement = buffer.join("\n");
      if (!isBlankOrComment(statement)) statements.push(statement);
      buffer = [];
    }
  }
  // Trailing content with no closing ";" (defensive — the real migrations
  // always terminate their final statement).
  const tail = buffer.join("\n");
  if (!isBlankOrComment(tail)) statements.push(tail);
  return statements;
}

function isBlankOrComment(chunk) {
  return chunk
    .split(/\r?\n/)
    .map((line) => line.trim())
    .every((line) => line.length === 0 || line.startsWith("--"));
}

// "file:C:/x/glossary.db" (or "file:./dev.db", possibly with ?params) -> the
// filesystem path we back up / test for existence.
function databaseFilePath(databaseUrl) {
  let filePath = databaseUrl.startsWith("file:")
    ? databaseUrl.slice("file:".length)
    : databaseUrl;
  const queryStart = filePath.indexOf("?");
  if (queryStart !== -1) filePath = filePath.slice(0, queryStart);
  return filePath;
}

/**
 * Apply every pending migration under `migrationsDir` to the database at
 * `databaseUrl`, in lexicographic order.
 *
 * @param {{ migrationsDir: string, databaseUrl: string }} options
 *   migrationsDir - folder of `<timestamp>_<name>/migration.sql` subdirectories.
 *   databaseUrl   - Prisma datasource URL, e.g. "file:C:/.../glossary.db".
 * @returns {Promise<{ applied: string[] }>} names of the migrations applied now.
 */
async function runMigrations({ migrationsDir, databaseUrl }) {
  // Capture existence BEFORE Prisma touches the file — connecting/creating the
  // control table would otherwise create it and defeat the "fresh install"
  // check below.
  const dbFile = databaseFilePath(databaseUrl);
  const dbExisted = fs.existsSync(dbFile);

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    await prisma.$executeRawUnsafe(CONTROL_TABLE_DDL);

    const appliedRows = await prisma.$queryRawUnsafe(
      'SELECT "migration_name" FROM "_prisma_migrations"',
    );
    const applied = new Set(appliedRows.map((row) => row.migration_name));

    const migrationNames = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    const pending = migrationNames.filter((name) => !applied.has(name));

    // Back up a real user database before mutating it: only when there is work
    // to do (pending), the file already exists, and it already carries at least
    // one applied migration (i.e. not a brand-new install, which has nothing to
    // lose). The copy sits next to the DB with a filename-safe ISO timestamp.
    if (pending.length > 0 && dbExisted && applied.size >= 1) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      fs.copyFileSync(dbFile, `${dbFile}.bak-${stamp}`);
    }

    for (const name of pending) {
      const sqlPath = path.join(migrationsDir, name, "migration.sql");
      const raw = fs.readFileSync(sqlPath);
      const checksum = checksumOf(raw);
      const statements = splitStatements(raw.toString("utf8"));

      // One statement at a time in autocommit: this is what lets the
      // `PRAGMA foreign_keys=OFF` in a table-rebuild migration take effect for
      // the DROP/RENAME that follow (a pragma inside a transaction is a no-op).
      // No partial-rollback of DDL — a failure throws and the caller decides.
      for (const statement of statements) {
        await prisma.$executeRawUnsafe(statement);
      }

      const now = Date.now();
      await prisma.$executeRawUnsafe(
        'INSERT INTO "_prisma_migrations" ' +
          '("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") ' +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        crypto.randomUUID(),
        checksum,
        now,
        name,
        null,
        null,
        now,
        statements.length,
      );
    }

    return { applied: pending };
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { runMigrations };
