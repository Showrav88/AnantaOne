import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function applyEnvFile(path: string) {
  if (!existsSync(path)) return;

  const result = config({ path });
  const parsed = result.parsed ?? {};
  if (Object.keys(parsed).length > 0) return;

  // Fallback: dotenv v17 / prisma may report 0 injected — parse manually
  const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  for (const line of text.split(/\r?\n/)) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("export ")) trimmed = trimmed.slice(7).trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

/** Load repo root .env then apps/api/.env (monorepo + VPS deploy). */
export function loadApiEnv() {
  const srcDir = dirname(fileURLToPath(import.meta.url));
  const appsApiDir = resolve(srcDir, "..");
  const repoRoot = resolve(appsApiDir, "..");
  applyEnvFile(resolve(repoRoot, ".env"));
  applyEnvFile(resolve(appsApiDir, ".env"));
}

/** Paths for Node --env-file (from apps/api cwd). */
export const ENV_FILE_ARGS = ["--env-file=../../.env", "--env-file=.env"];
