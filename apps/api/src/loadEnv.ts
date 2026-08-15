import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Load repo root .env then apps/api/.env (monorepo + VPS deploy). */
export function loadApiEnv() {
  const apiRoot = dirname(fileURLToPath(import.meta.url));
  config({ path: resolve(apiRoot, "../../.env") });
  config({ path: resolve(apiRoot, ".env") });
}
