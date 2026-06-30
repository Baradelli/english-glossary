// dev/start launcher: choose the server port from .env.
//
// Next loads .env into the app at runtime, but not early enough to pick the
// port it listens on. So we read PORT here (precedence: .env.local > .env) and
// pass it to the Next CLI with -p. No PORT set → Next's default (3000).
//
// Usage: node scripts/next-with-port.mjs <dev|start>

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

for (const file of [".env", ".env.local"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const command = process.argv[2];
if (command !== "dev" && command !== "start") {
  console.error(`Unknown command "${command}". Use "dev" or "start".`);
  process.exit(1);
}

const args = [command];
const port = process.env.PORT?.trim();
if (port) args.push("-p", port);

spawn("next", args, { stdio: "inherit", shell: true }).on("exit", (code) =>
  process.exit(code ?? 0),
);
