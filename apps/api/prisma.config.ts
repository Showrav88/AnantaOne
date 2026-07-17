import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prefer DIRECT_DATABASE_URL for Neon migrations; fall back for local Docker.
// Placeholder lets `prisma generate` run before .env exists.
const url =
  process.env.DIRECT_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://ananta:ananta123@localhost:5432/anantaone";

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
