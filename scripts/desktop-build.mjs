#!/usr/bin/env node
// desktop build orchestrator: produce a self-contained Next server we can fork.
//
// Electron (later tasks) will fork `.next/standalone/server.js` as a child
// process. Next's `output: "standalone"` traces the server + its node_modules
// into `.next/standalone`, but leaves three gaps we patch here:
//   1. `.next/static` (and `public/`) are NOT copied into standalone — Next
//      assumes a CDN serves them; we serve them ourselves, so we copy them in.
//   2. Next copies the project's `.env*` into standalone. THIS project's `.env`
//      holds a REAL ANTHROPIC_API_KEY, so we delete every `.env*` from the
//      standalone output and hard-fail if any survives — a key must never ship.
//   3. The standalone package.json's "type" must match the module system of
//      the generated `server.js`, or Node throws at startup. Empirically, Next
//      15.5.x emits an ESM server.js (top-level `import`, `import.meta.url`),
//      which needs "type":"module"; older/other outputs are CommonJS and need
//      "type":"commonjs". We DETECT server.js's format and set "type" to match,
//      rather than assuming (its node_modules deps keep their own package.json,
//      so this top-level patch is safe either way).
//
// Run: node scripts/desktop-build.mjs  (npm run desktop:build)

import { spawn, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import electronPath from "electron";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standaloneDir = path.join(rootDir, ".next", "standalone");
const distElectronDir = path.join(rootDir, "dist-electron");

const PREVIEW = process.argv.includes("--preview");
const BUNDLE_ONLY = process.argv.includes("--bundle-only");
const PUBLISH = process.argv.includes("--publish");

function log(stage, message) {
  console.log(`[desktop-build:${stage}] ${message}`);
}

function fail(stage, message) {
  console.error(`[desktop-build:${stage}] ERROR: ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// stage: build — next build with standalone output.
// ---------------------------------------------------------------------------
function stageBuild() {
  log("build", "running `next build` with NEXT_OUTPUT=standalone…");
  const result = spawnSync("npx", ["next", "build"], {
    cwd: rootDir,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, NEXT_OUTPUT: "standalone" },
  });
  if (result.status !== 0) {
    fail("build", `next build exited with code ${result.status ?? "null"}`);
  }
  if (!existsSync(standaloneDir)) {
    fail("build", `expected standalone output at ${standaloneDir}, not found`);
  }
  log("build", "next build complete.");
}

// ---------------------------------------------------------------------------
// stage: prepare — copy statics, strip secrets, fix module type.
// ---------------------------------------------------------------------------
function copyStatics() {
  const staticSrc = path.join(rootDir, ".next", "static");
  const staticDest = path.join(standaloneDir, ".next", "static");
  if (!existsSync(staticSrc)) {
    fail("prepare", `.next/static not found at ${staticSrc} (build incomplete?)`);
  }
  cpSync(staticSrc, staticDest, { recursive: true });
  log("prepare", "copied .next/static → .next/standalone/.next/static");

  // public/ does not exist in this project; copy only if it appears later.
  const publicSrc = path.join(rootDir, "public");
  if (existsSync(publicSrc)) {
    cpSync(publicSrc, path.join(standaloneDir, "public"), { recursive: true });
    log("prepare", "copied public/ → .next/standalone/public");
  } else {
    log("prepare", "no public/ directory — skipping (optional).");
  }
}

function stripEnvFiles() {
  // SECURITY-CRITICAL: Next copies .env/.env.local/etc. into the standalone
  // output, and this project's .env carries a real API key. Delete them all,
  // then assert none remain. Never ship a standalone with a .env.
  const envFiles = () =>
    readdirSync(standaloneDir).filter((name) => name.startsWith(".env"));

  const found = envFiles();
  for (const name of found) {
    rmSync(path.join(standaloneDir, name), { force: true });
    log("prepare", `deleted secret file .next/standalone/${name}`);
  }
  if (found.length === 0) {
    log("prepare", "no .env* files in standalone output (nothing to delete).");
  }

  const remaining = envFiles();
  if (remaining.length > 0) {
    fail(
      "prepare",
      `.env* still present in standalone after deletion: ${remaining.join(", ")} — refusing to continue.`,
    );
  }
  log("prepare", "verified: no .env* remain in standalone output.");
}

function fixModuleType() {
  const pkgPath = path.join(standaloneDir, "package.json");
  if (!existsSync(pkgPath)) {
    log("prepare", "no standalone package.json — skipping type patch.");
    return;
  }
  const serverPath = path.join(standaloneDir, "server.js");
  const serverSrc = existsSync(serverPath) ? readFileSync(serverPath, "utf8") : "";
  // ESM markers: a top-level `import …` statement or `import.meta` usage.
  // (Next 15.5.x emits ESM here; a CJS server.js would use require/module.exports.)
  const serverIsEsm =
    /^\s*import[\s{*]/m.test(serverSrc) || /\bimport\.meta\b/.test(serverSrc);
  const desiredType = serverIsEsm ? "module" : "commonjs";
  const format = serverIsEsm ? "ESM" : "CommonJS";

  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  if (pkg.type !== desiredType) {
    const prev = pkg.type ?? "unset";
    pkg.type = desiredType;
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
    log(
      "prepare",
      `patched standalone package.json "type": ${prev} → ${desiredType} (server.js is ${format}).`,
    );
  } else {
    log(
      "prepare",
      `standalone package.json "type" already "${pkg.type}", matches server.js (${format}) — no patch needed.`,
    );
  }
}

function copyBootstrapFiles() {
  // These arrive in Tasks 9-10 (migration runner + CJS bootstrap). Copy if present.
  const serverDir = path.join(rootDir, "electron", "server");
  for (const file of ["bootstrap.cjs", "migrate.cjs"]) {
    const src = path.join(serverDir, file);
    if (existsSync(src)) {
      cpSync(src, path.join(standaloneDir, file));
      log("prepare", `copied electron/server/${file} → .next/standalone/${file}`);
    } else {
      log("prepare", `electron/server/${file} not present yet — skip (Tasks 9-10).`);
    }
  }
}

function stagePrepare() {
  log("prepare", "preparing standalone directory…");
  copyStatics();
  stripEnvFiles();
  fixModuleType();
  copyBootstrapFiles();
  log("prepare", "standalone directory ready.");
}

// ---------------------------------------------------------------------------
// stage: bundle main (Task 10) — esbuild the Electron main process to CJS.
//
// electron/main.ts is authored as ESM but Electron loads the main entry as
// CommonJS (package.json "main": "dist-electron/main.cjs"). esbuild bundles it
// to a single .cjs, marking `electron` external (Electron provides it at
// runtime) and leaving Node builtins external via platform=node. We also copy
// the static splash next to the bundle; main.ts resolves it relative to
// __dirname (= dist-electron/).
// ---------------------------------------------------------------------------
async function stageBundleMain() {
  log("bundle", "bundling electron/main.ts → dist-electron/main.cjs…");
  mkdirSync(distElectronDir, { recursive: true });
  await esbuild({
    entryPoints: [path.join(rootDir, "electron", "main.ts")],
    outfile: path.join(distElectronDir, "main.cjs"),
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    external: ["electron"],
    logLevel: "info",
  });
  log("bundle", "bundled main.cjs.");

  const splashSrc = path.join(rootDir, "electron", "splash.html");
  if (!existsSync(splashSrc)) {
    fail("bundle", `electron/splash.html not found at ${splashSrc}`);
  }
  cpSync(splashSrc, path.join(distElectronDir, "splash.html"));
  log("bundle", "copied electron/splash.html → dist-electron/splash.html");
}

// ---------------------------------------------------------------------------
// stage: preview (Task 10) — launch the built app with Electron.
// Runs the real main process against the built standalone; does NOT invoke
// electron-builder (that is Task 12). Env (e.g. GLOSSARY_DB_PATH) is inherited.
// ---------------------------------------------------------------------------
function stagePreview() {
  log("preview", "launching Electron (electron .)…");
  // `electronPath` is the absolute path to Electron's binary (the electron
  // package exports it when imported from plain Node), so we spawn it directly
  // — no shell, no .cmd shim, no arg-escaping deprecation warning.
  const child = spawn(electronPath, ["."], {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code) => {
    log("preview", `Electron exited with code ${code ?? "null"}.`);
    process.exit(code ?? 0);
  });
}

// ---------------------------------------------------------------------------
// stage: package (Task 12) — electron-builder → NSIS installer.
//
// Only runs in the full flow (no --preview / --bundle-only). electron-builder
// reads electron-builder.yml at the repo root: it packs dist-electron + the
// standalone/migrations (via extraResources) into resources/, wraps it in an
// asar, and emits `release/English Glossary Setup <version>.exe` (NSIS).
// `--publish never` keeps this a purely local build. `--publish` (Task 13)
// switches to `--publish always`, which additionally uploads the exe +
// latest.yml + blockmap to a draft GitHub release (electron-builder.yml's
// `publish:` block points at Baradelli/english-glossary) — this is what
// `npm run desktop:publish` uses, and it requires GH_TOKEN (checked before we
// spend minutes building — see requireGhToken()).
// The first run downloads the NSIS toolchain, so give it a generous timeout.
// ---------------------------------------------------------------------------
function requireGhToken() {
  if (!process.env.GH_TOKEN) {
    // Exact wording/format required by the spec — not routed through fail()
    // (which prefixes "[desktop-build:<stage>] ERROR:") so scripts/CI can
    // match on this literal message.
    console.error(
      "[desktop-build] GH_TOKEN ausente. Exporte um token com escopo repo para publicar.",
    );
    process.exit(1);
  }
}

function stagePackage() {
  return new Promise((resolve) => {
    const publishMode = PUBLISH ? "always" : "never";
    log("package", `running electron-builder (--win --publish ${publishMode})…`);
    const child = spawn(
      "npx",
      ["electron-builder", "--win", "--publish", publishMode],
      { cwd: rootDir, stdio: "inherit", shell: true },
    );
    child.on("exit", (code) => {
      if (code !== 0) {
        fail("package", `electron-builder exited with code ${code ?? "null"}`);
      }
      log(
        "package",
        PUBLISH
          ? "installer built and published as a draft GitHub release."
          : "installer built under release/.",
      );
      resolve();
    });
  });
}

async function main() {
  if (BUNDLE_ONLY) {
    // Task 11's desktop:dev launcher: only the main process needs rebuilding
    // against a live `next dev` server, so skip `next build`/prepare entirely.
    await stageBundleMain();
    log("done", "bundle-only build finished. main at dist-electron/main.cjs");
    return;
  }
  // Fail fast, before spending minutes on `next build`/electron-builder, if
  // this is a publish run with no token to authenticate the GitHub upload.
  if (PUBLISH) requireGhToken();
  stageBuild();
  stagePrepare();
  await stageBundleMain();
  if (PREVIEW) {
    stagePreview();
  } else {
    await stagePackage();
    log(
      "done",
      PUBLISH
        ? "desktop build finished. draft release published on GitHub."
        : "desktop build finished. installer at release/",
    );
  }
}

main().catch((err) => {
  fail("main", err?.stack ?? String(err));
});
