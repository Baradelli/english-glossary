#!/usr/bin/env node
// desktop dev launcher: open the Electron shell against a running `next dev`.
//
// Task 10 gave electron/main.ts a GLOSSARY_DEV_URL branch: when set, it skips
// forking the standalone server and migrations entirely, and just loads that
// URL — so this script never starts Next itself. Workflow:
//   1. `npm run dev` in one terminal (real Next dev server, HMR).
//   2. `npm run desktop:dev` in another: bundles main.ts only (no `next
//      build`), probes the dev server, then launches `electron .` pointed at
//      it.
//
// Run: node scripts/desktop-dev.mjs  (npm run desktop:dev)

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import electronPath from "electron";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function log(message) {
  console.log(`[desktop-dev] ${message}`);
}

function fail(message, code = 1) {
  console.error(`[desktop-dev] ${message}`);
  process.exit(code);
}

// Same precedence as next-with-port.mjs: process.loadEnvFile never overwrites
// a var that is already set, so real env > .env.local > .env.
for (const file of [".env", ".env.local"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const port = process.env.PORT?.trim() || "3000";
const devUrl = `http://localhost:${port}`;

// ---------------------------------------------------------------------------
// Probe: is `next dev` already listening? We never start it ourselves — the
// developer runs `npm run dev` in another terminal.
// ---------------------------------------------------------------------------
function probeDevServer(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 2_000 }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  const reachable = await probeDevServer(devUrl);
  if (!reachable) {
    fail(
      `Dev server não encontrado em ${devUrl}. Rode "npm run dev" em outro terminal e tente de novo.`,
    );
  }
  log(`dev server encontrado em ${devUrl}.`);

  log("bundling electron/main.ts (bundle-only)…");
  const bundleResult = spawnSync(
    process.execPath,
    [path.join(rootDir, "scripts", "desktop-build.mjs"), "--bundle-only"],
    { cwd: rootDir, stdio: "inherit" },
  );
  if (bundleResult.status !== 0) {
    fail(`bundle step exited with code ${bundleResult.status ?? "null"}.`, bundleResult.status ?? 1);
  }

  log(`launching Electron (electron .) against ${devUrl}…`);
  const child = spawn(electronPath, ["."], {
    cwd: rootDir,
    stdio: "inherit",
    env: { ...process.env, GLOSSARY_DEV_URL: devUrl },
  });
  child.on("exit", (code) => {
    log(`Electron exited with code ${code ?? "null"}.`);
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  fail(err?.stack ?? String(err));
});
