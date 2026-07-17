import "dotenv/config";
import { defineConfig } from "prisma/config";

const isGenerateOnly = process.argv.includes("generate");

// Prefer DIRECT_DATABASE_URL (Neon direct / Render). Never silently use localhost
// during migrate/deploy — that caused Render builds to hit localhost:5432.
const url =
  process.env.DIRECT_DATABASE_URL ||
  process.env.DATABASE_URL ||
  (isGenerateOnly
    ? "postgresql://127.0.0.1:5432/anantaone"
    : undefined);

if (!url) {
  throw new Error(
    "DATABASE_URL (or DIRECT_DATABASE_URL) is not set. On Render → Web Service → Environment, paste the Postgres URL with ?sslmode=require. See docs/RENDER.md.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url,
  },
});
