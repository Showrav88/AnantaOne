# AnantaOne — Database setup

Schema lives in **Git + Prisma migrations**, not in Docker. Docker and Neon are just two ways to run PostgreSQL.

```
schema.prisma  →  prisma/migrations/*.sql  →  committed to GitHub
Cloud Agent and PC both apply the same migration files.
```

| Environment | Postgres | Redis |
|---|---|---|
| **Cloud Agent** (no Docker) | Neon free tier | Optional / skip for early Phase 1 |
| **Local PC** | Docker Compose (`postgres:18-alpine`) | Docker Compose (`redis:8-alpine`) |

---

## Rules (keep cloud + PC in sync)

| Rule | Why |
|---|---|
| Always commit migration files | Cloud and PC stay aligned |
| Use `npm run db:migrate` when changing schema | Creates migration SQL in Git |
| Use `npm run db:migrate:deploy` on other machines | Applies existing migrations — do not skip |
| Do **not** use `db:push` on shared branches | Skips migration history — breaks sync |
| Never commit `.env` | Each environment has its own `DATABASE_URL` |

---

## Cloud today (Neon — no Docker)

### 1. Create a Neon project

1. Sign up at [https://neon.tech](https://neon.tech) (free tier is enough)
2. Create project → database (e.g. `anantaone`)
3. Copy the **connection string**

Neon shows two URLs:

| URL | Use |
|---|---|
| **Pooled** (`-pooler` in host) | App runtime (`DATABASE_URL`) |
| **Direct** (no pooler) | Prisma migrations (`DIRECT_DATABASE_URL`) |

If Neon only gives one URL, use it for both until you enable pooling.

### 2. Set env on Cloud Agent

Create root `.env` and `apps/api/.env` (never commit):

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

Set:

```env
DATABASE_URL=postgresql://USER:PASS@ep-xxx-pooler.region.aws.neon.tech/anantaone?sslmode=require
DIRECT_DATABASE_URL=postgresql://USER:PASS@ep-xxx.region.aws.neon.tech/anantaone?sslmode=require
```

Or set the same values in Cloud Agent **environment variables** / secrets UI.

### 3. Install and migrate

```bash
# Node 26 required (see docs/STACK.md)
npm install
npm run db:migrate:deploy   # apply committed migrations
npm run db:generate         # generate Prisma Client
npm run db:seed             # optional demo data
npm run dev
```

When **changing** schema on cloud:

```bash
npm run db:migrate          # creates + applies a new migration
# commit apps/api/prisma/migrations/**
git add apps/api/prisma && git commit -m "Add migration: describe change" && git push
```

---

## Later: Local PC + Docker

```bash
git checkout local-dev
git pull origin cloud-dev    # or pull your feature branch

docker compose up -d
cp .env.example .env
cp apps/api/.env.example apps/api/.env
# .env already points at localhost:5432 — leave as-is for Docker

npm install
npm run db:migrate:deploy    # same migrations, fresh local DB
npm run db:generate
npm run db:seed              # optional
npm run dev
```

Local DB starts **empty** — that is normal. Migrations recreate the same tables. Cloud Neon data and local Docker data are separate; structure stays the same.

---

## npm scripts

| Script | When |
|---|---|
| `npm run db:migrate` | Dev: create + apply a new migration after schema edits |
| `npm run db:migrate:deploy` | CI / new machine / cloud / PC: apply existing migrations |
| `npm run db:generate` | After pull or schema change: regenerate client |
| `npm run db:seed` | Load demo data |
| `npm run db:studio` | Open Prisma Studio |

---

## Cloud vs local (expected differences)

| | Cloud (Neon) | Local (Docker) |
|---|---|---|
| Data | Agent / shared cloud test data | Empty until seed |
| URL | Neon connection string | `localhost:5432` |
| Code | Same | Same |
| Migrations | Same files in Git | Same files in Git |

Different data, same structure — expected.

---

## Recommended path

**Today (no Docker):**

```
Cloud Agent on cloud-dev
  + Neon PostgreSQL (free)
  → build features, commit migrations, push
```

**Later (PC + Docker):**

```
Install Docker Desktop
  → git pull
  → docker compose up -d
  → npm run db:migrate:deploy
  → continue same project locally
```
