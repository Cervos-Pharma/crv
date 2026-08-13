/**
 * @file scripts/dev-mock.mjs
 * @description Launches `next dev` with NEXT_PUBLIC_MOCK_MODE=true so the web
 * app runs entirely against the in-memory mock backend (no Supabase needed).
 * Cross-platform — works on Windows PowerShell (avoids env-var syntax issues).
 *
 * Usage:  npm run dev:mock
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const isWin = process.platform === "win32";

// On Windows, `next` must run through the .cmd shim via the shell; on POSIX
// we can exec the CLI script directly with the system node.
const nextBin = join(root, "node_modules", ".bin", isWin ? "next.cmd" : "next");

// Mock mode must work with zero configuration. Next.js keeps any value already
// in process.env over .env.local, so we inject a valid demo HQ secret here —
// otherwise loginHQ rejects the placeholder/too-short secret in the user's env.
const mockEnv = {
  ...process.env,
  NEXT_PUBLIC_MOCK_MODE: "true",
  HQ_SECRET: process.env.HQ_SECRET ?? "mock-hq-secret-for-local-demo-2026-xxxxxxxxxx",
};

const child = spawn(isWin ? "cmd" : nextBin, isWin ? ["/c", nextBin, "dev", "-p", "5000"] : ["dev", "-p", "5000"], {
  cwd: root,
  stdio: "inherit",
  env: mockEnv,
  shell: false,
});

child.on("error", (err) => {
  console.error(`[dev-mock] failed to start next dev: ${err.message}`);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
