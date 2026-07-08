// Electron main process for the English Glossary desktop app.
//
// Responsibilities, in order:
//   1. Enforce a single running instance (a second launch focuses the window).
//   2. Pick a free loopback port and fork the Next standalone server as a
//      utilityProcess. The forked bootstrap.cjs applies pending migrations
//      BEFORE the server binds, so the DB is always current when we connect.
//   3. Show a splash window immediately, poll the server, and swap to the app
//      the moment it answers.
//   4. If the server never comes up (boot timeout or the child exits non-zero,
//      e.g. a failed migration), show a readable, actionable error dialog.
//
// Security: context isolation on, node integration off, no preload — the
// renderer only ever loads our own static splash and a localhost HTTP origin.
// External links are handed to the OS browser instead of opening in-app.

import { app, BrowserWindow, dialog, shell, utilityProcess } from "electron";
import type { UtilityProcess } from "electron";
import { autoUpdater } from "electron-updater";
import http from "node:http";
import net from "node:net";
import path from "node:path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const READY_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 250;
const STDERR_BUFFER_LINES = 50;

// Variables from the parent environment that the forked server legitimately
// needs. ANTHROPIC_* power the AI features; PATH/SystemRoot let Node and the
// Prisma native engine resolve system libraries on Windows.
const PASSTHROUGH_ENV = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL",
  "PATH",
  "SystemRoot",
] as const;

// Resolved once app is ready (needs app.getPath / app.isPackaged).
let standaloneDir = "";
let migrationsDir = "";
let dbPath = "";

let win: BrowserWindow | null = null;
let child: UtilityProcess | null = null;

// The last lines the child wrote to stderr, kept for the failure dialog.
const stderrTail: string[] = [];

// Guards the ready-vs-failure race: whichever fires first wins, the other is
// ignored. A late child exit after a successful boot only logs.
let settled = false;
let readyTimer: NodeJS.Timeout | null = null;

// Set while the failure dialog is up so the window-all-closed auto-quit does
// not race it: onFailure owns the quit in that state.
let handlingFailure = false;

// Set as soon as the app is intentionally quitting (before-quit /
// window-all-closed). Killing the child then makes it exit non-zero/null,
// which must NOT be mistaken for a startup failure — see onFailure/exit guard.
let quitting = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ask the OS for a free TCP port on loopback, then release it for the child. */
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      if (address && typeof address === "object") {
        const { port } = address;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error("could not determine free port")));
      }
    });
  });
}

/** Echo a child stream to our console line-by-line, optionally buffering it. */
function pipeChildOutput(chunk: Buffer, buffer?: string[]): void {
  const text = chunk.toString();
  for (const line of text.split(/\r?\n/)) {
    if (line.length === 0) continue;
    console.log(`[server] ${line}`);
    if (buffer) {
      buffer.push(line);
      while (buffer.length > STDERR_BUFFER_LINES) buffer.shift();
    }
  }
}

function killChild(): void {
  if (child) {
    try {
      child.kill();
    } catch {
      // already gone
    }
    child = null;
  }
}

// ---------------------------------------------------------------------------
// Readiness / failure
// ---------------------------------------------------------------------------

function onReady(port: number): void {
  if (settled) return;
  settled = true;
  if (readyTimer) clearTimeout(readyTimer);
  const url = `http://127.0.0.1:${port}/`;
  // This exact line is what the smoke test greps for.
  console.log(`[main] app ready at http://127.0.0.1:${port}`);
  if (win && !win.isDestroyed()) {
    // Auto-update only ever starts once the real app has actually loaded —
    // never before/during boot. See startAutoUpdater() for the packaged-only
    // guard and the offline-first error handling.
    void win
      .loadURL(url)
      .then(() => startAutoUpdater())
      .catch((err) => console.error(`[main] loadURL failed: ${err}`));
  }
}

function onFailure(reason: string): void {
  if (settled) return;
  if (quitting) return;
  settled = true;
  handlingFailure = true;
  if (readyTimer) clearTimeout(readyTimer);
  console.error(`[main] startup failed: ${reason}`);

  const tail = stderrTail.join("\n").trim() || "(o servidor não produziu saída de erro)";
  // A migration crash can leave the DB half-migrated; migrate.cjs writes a
  // .bak-* next to it first, so point the user at the backup.
  const looksLikeMigration = /migrat|\[bootstrap\]/i.test(tail);
  const detail = looksLikeMigration
    ? `${tail}\n\nUma atualização do banco pode ter falhado. Há um backup automático (glossary.db.bak-...) na pasta do banco de dados — renomeie-o para glossary.db para restaurar.`
    : tail;

  const options = {
    type: "error" as const,
    title: "English Glossary",
    message:
      "O English Glossary não conseguiu iniciar." +
      (reason === "timeout"
        ? " O servidor demorou demais para responder."
        : ""),
    detail,
    buttons: ["Abrir pasta do banco", "Fechar"],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  };

  // A fast child crash can beat the splash window's "ready-to-show", leaving it
  // hidden. Force it visible so the modal has a real parent and the user is not
  // left staring at an invisible dialog / empty desktop.
  const parent = win && !win.isDestroyed() ? win : null;
  if (parent && !parent.isVisible()) parent.show();

  // Synchronous on purpose: an async dialog yields the event loop, and with no
  // visible window Electron's auto-quit can tear the app down before the user
  // ever sees the dialog. showMessageBoxSync blocks the main thread until a
  // button is clicked, so nothing can quit out from under it.
  const response = parent
    ? dialog.showMessageBoxSync(parent, options)
    : dialog.showMessageBoxSync(options);

  if (response === 0) {
    shell.showItemInFolder(dbPath);
  }
  app.quit();
}

function pollUntilReady(port: number): void {
  if (settled) return;
  const req = http.get(
    { host: "127.0.0.1", port, path: "/", timeout: 2_000 },
    (res) => {
      res.resume(); // any HTTP response means the server is up
      onReady(port);
    },
  );
  req.on("error", () => {
    req.destroy();
    if (!settled) setTimeout(() => pollUntilReady(port), POLL_INTERVAL_MS);
  });
  req.on("timeout", () => {
    req.destroy();
    if (!settled) setTimeout(() => pollUntilReady(port), POLL_INTERVAL_MS);
  });
}

// ---------------------------------------------------------------------------
// Window + server
// ---------------------------------------------------------------------------

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: "#f8fafc",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // No preload: the renderer needs no privileged bridge.
    },
  });

  window.once("ready-to-show", () => window.show());

  // Send target=_blank / window.open and external navigations to the OS
  // browser rather than opening a chromeless in-app window.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  return window;
}

function startServer(port: number): void {
  const bootstrap = path.join(standaloneDir, "bootstrap.cjs");
  const databaseUrl = "file:" + dbPath.replaceAll("\\", "/");

  const env: Record<string, string> = {
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    DATABASE_URL: databaseUrl,
    MIGRATIONS_DIR: migrationsDir,
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  for (const key of PASSTHROUGH_ENV) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }

  console.log(`[main] forking server: ${bootstrap}`);
  console.log(`[main] db: ${databaseUrl}`);

  child = utilityProcess.fork(bootstrap, [], {
    cwd: standaloneDir,
    stdio: "pipe",
    serviceName: "english-glossary-server",
    env,
  });

  child.stdout?.on("data", (chunk: Buffer) => pipeChildOutput(chunk));
  child.stderr?.on("data", (chunk: Buffer) => pipeChildOutput(chunk, stderrTail));

  child.on("exit", (code) => {
    console.log(`[server] process exited with code ${code}`);
    child = null;
    if (!settled && !quitting && code !== 0) {
      onFailure(`server exited with code ${code}`);
    }
  });

  readyTimer = setTimeout(() => onFailure("timeout"), READY_TIMEOUT_MS);
  pollUntilReady(port);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function boot(): Promise<void> {
  win = createWindow();
  await win.loadFile(path.join(__dirname, "splash.html"));

  // Dev branch: Task 11's desktop:dev sets GLOSSARY_DEV_URL to a running
  // `next dev` server. Skip forking/migrations entirely and just load it.
  const devUrl = process.env.GLOSSARY_DEV_URL;
  if (devUrl) {
    console.log(`[main] GLOSSARY_DEV_URL set — loading ${devUrl} (no server fork)`);
    settled = true;
    await win.loadURL(devUrl);
    return;
  }

  standaloneDir = app.isPackaged
    ? path.join(process.resourcesPath, "app")
    : path.resolve(".next/standalone");
  migrationsDir = app.isPackaged
    ? path.join(process.resourcesPath, "migrations")
    : path.resolve("prisma/migrations");
  dbPath =
    process.env.GLOSSARY_DB_PATH ??
    path.join(app.getPath("userData"), "glossary.db");

  const port = await findFreePort();
  startServer(port);
}

// ---------------------------------------------------------------------------
// Auto-update (Task 13)
//
// Offline-first: this app must be fully usable with no network at all. Every
// updater failure — no connection, GitHub unreachable, a 404 because no
// release has been published yet — is logged with a `[updater]` prefix and
// otherwise INVISIBLE to the user. No dialog, no boot delay, no interruption.
// The only user-facing surface is the "update-downloaded" dialog, and only
// once a release is actually staged and ready to install.
//
// Only runs once: app.isPackaged (never in `desktop:dev`/`desktop:preview`,
// which run unpackaged), AND only after boot() has forked the server and the
// window has successfully loaded it (called from onReady()'s loadURL
// continuation — see above). The GLOSSARY_DEV_URL branch in boot() returns
// before onReady is ever reached, so this never runs there either.
// ---------------------------------------------------------------------------

let autoUpdaterStarted = false;

function startAutoUpdater(): void {
  if (!app.isPackaged) return;
  if (autoUpdaterStarted) return;
  autoUpdaterStarted = true;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Never checkForUpdatesAndNotify(): that also raises the OS-native
  // notification, which would duplicate our own dialog below.
  autoUpdater.on("update-downloaded", (info) => {
    if (!win || win.isDestroyed()) return;
    void dialog
      .showMessageBox(win, {
        type: "info",
        title: "English Glossary",
        message: `Nova versão ${info.version} baixada.`,
        detail: "Reinicie para aplicar a atualização.",
        buttons: ["Reiniciar agora", "Ao fechar"],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      })
      .then(({ response }) => {
        // "Ao fechar": do nothing — autoInstallOnAppQuit installs it when the
        // app quits normally. "Reiniciar agora": quitAndInstall() triggers
        // app.quit(), which runs our existing before-quit → killChild path
        // before the installer replaces the files.
        if (response === 0) autoUpdater.quitAndInstall();
      });
  });

  autoUpdater.on("error", (err) => {
    // Offline-first, non-negotiable: no dialog, ever. Log only.
    console.error(`[updater] ${err instanceof Error ? err.message : String(err)}`);
  });

  console.log("[updater] checking for updates…");
  autoUpdater.checkForUpdates().catch((err: unknown) => {
    // checkForUpdates() also rejects on failure in addition to emitting
    // "error" above — catch it too so a network failure never becomes an
    // unhandled promise rejection.
    console.error(
      `[updater] checkForUpdates failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(boot).catch((err) => {
    console.error("[main] fatal during boot:", err);
    onFailure(String(err));
  });

  app.on("window-all-closed", () => {
    // While the failure dialog is showing, onFailure owns the quit — don't
    // race it here (the splash may already be gone behind the dialog).
    if (!handlingFailure) {
      quitting = true;
      app.quit();
    }
  });

  // Kill the forked server on every exit path (quit, window close, dialog
  // close) so no orphan Node process survives the app. Mark quitting first so
  // the child's resulting non-zero/null exit isn't mistaken for a startup
  // failure (see onFailure / the exit handler's guard).
  app.on("before-quit", () => {
    quitting = true;
    killChild();
  });
  app.on("will-quit", killChild);
}
