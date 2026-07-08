"use strict";

// Entrypoint for Electron's utilityProcess.fork. It runs inside the Next
// standalone bundle, which the desktop build patches to "type": "module" so
// server.js loads as ESM. A `.cjs` file is ALWAYS CommonJS regardless of that
// "type", which is exactly why the bootstrap lives here: it can `require()` the
// CommonJS migration runner AND `await import()` the ESM server.js in the same
// process. desktop-build.mjs copies this file (and migrate.cjs) to the
// standalone root, so `__dirname` / cwd are that root and the relative requires
// resolve against the bundled node_modules.
process.chdir(__dirname);

// Fail loud and early if the main process forgot a required variable, rather
// than letting Prisma/server.js throw a cryptic error deeper in the stack. The
// non-zero exit here is what surfaces the migration/boot error dialog in main.
function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[bootstrap] missing required environment variable: ${name}`);
  }
  return value;
}

(async () => {
  const { runMigrations } = require("./migrate.cjs");
  const migrationsDir = requireEnv("MIGRATIONS_DIR");
  const databaseUrl = requireEnv("DATABASE_URL");
  requireEnv("PORT");
  requireEnv("HOSTNAME");

  const { applied } = await runMigrations({ migrationsDir, databaseUrl });
  console.log(
    applied.length > 0
      ? `[bootstrap] applied ${applied.length} migration(s): ${applied.join(", ")}`
      : "[bootstrap] database already up to date (no migrations applied)",
  );

  // server.js reads PORT/HOSTNAME from the env we were forked with and starts
  // listening as a side effect of being imported.
  await import("./server.js");
})().catch((err) => {
  console.error("[bootstrap]", err);
  process.exit(1);
});
