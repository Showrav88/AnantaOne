# AnantaOne — Database setup

Schema lives in **Git + Prisma migrations**, not in Docker or Neon.

```
schema.prisma  →  prisma/migrations/*.sql  →  committed to GitHub
Cloud Agent and PC both apply the same migration files.
```

| Environment | Postgres options | Redis |
|---|---|---|
| **Cloud Agent** | **A)** Install Postgres on the VM (no Neon) · **B)** Neon free tier | Optional / skip early Phase 1 |
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

## Option A — Postgres on the Cloud VM (no Neon)

Cloud Agent Ubuntu VMs have `sudo` and apt. Docker is often missing; install PostgreSQL **directly**.

### One command

```bash
bash scripts/setup-cloud-postgres.sh
```

This installs **PostgreSQL 18**, creates user `ananta` / db `anantaone`, and matches `.env.example`:

```env
DATABASE_URL=postgresql://ananta:ananta123@localhost:5432/anantaone
DIRECT_DATABASE_URL=postgresql://ananta:ananta123@localhost:5432/anantaone
```

### Then migrate + run

```bash
# Node 26 (see .nvmrc / docs/STACK.md)
npm install
npm run db:migrate:deploy
npm run db:generate
npm run db:seed   # optional
npm run dev
```

### After a VM restart

systemd may not run in cloud VMs — start the cluster manually:

```bash
sudo pg_ctlcluster 18 main start
pg_lsclusters   # should show 18/main online
```

**Note:** VM disk data is local to that agent environment. Prefer committing migrations; do not rely on VM data as the source of truth.

When **changing** schema on cloud:

```bash
npm run db:migrate          # creates + applies a new migration
git add apps/api/prisma && git commit -m "Add migration: describe change" && git push
```

---

## Option B — Neon (managed cloud Postgres)

Use Neon if you want a DB that survives across agent VMs / machines.

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

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

```env
DATABASE_URL=postgresql://USER:PASS@ep-xxx-pooler.region.aws.neon.tech/anantaone?sslmode=require
DIRECT_DATABASE_URL=postgresql://USER:PASS@ep-xxx.region.aws.neon.tech/anantaone?sslmode=require
```

### 3. Migrate + run

```bash
npm install
npm run db:migrate:deploy
npm run db:generate
npm run db:seed
npm run dev
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

Local DB starts **empty** — that is normal. Migrations recreate the same tables. Cloud VM / Neon data and local Docker data are separate; structure stays the same.

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

| | Cloud VM Postgres | Neon | Local Docker |
|---|---|---|---|
| Data | On that VM only | Survives across machines | Empty until seed |
| URL | `localhost:5432` | Neon host | `localhost:5432` |
| Code | Same | Same | Same |
| Migrations | Same files in Git | Same | Same |

Different data, same structure — expected.

---

## Recommended path

**Today (Cloud Agent, no Docker):**

```
bash scripts/setup-cloud-postgres.sh   # Postgres 18 on the VM
  → npm run db:migrate:deploy
  → build features, commit migrations, push
```

**Or Neon** if you want DB data shared across agents/PCs.

**Later (PC + Docker):**

```
Install Docker Desktop
  → git pull
  → docker compose up -d
  → npm run db:migrate:deploy
  → continue same project locally
```
