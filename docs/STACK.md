# AnantaOne — Tech Stack (Latest Only)

> **Policy:** Always use latest **stable** versions. No old/LTS unless noted.  
> **Last updated:** July 2026

## Locked versions

| Layer | Technology | Version |
|---|---|---|
| Database | PostgreSQL | **18.4** |
| Runtime | Node.js | **26.5.0** |
| Language | TypeScript | **7.0** |
| Backend | Express | **5.2.1** |
| ORM | Prisma | **7.8.0** |
| Web UI | React | **19.2.7** |
| Web bundler | Vite | **8.0** |
| Mobile | Expo SDK | **57.0.0** |
| Mobile runtime | React Native | **0.86** |
| Styling | Tailwind CSS | **4.x** |
| UI kit | shadcn/ui | Latest |
| Monorepo | Turborepo | **2.x** |
| Validation | Zod | **4.x** |
| Realtime | Socket.io | **4.8.x** |
| Cache / queue | Redis | **8.x** |
| Job queue | BullMQ | **5.x** |
| Unit / API tests | Vitest | **4.x** |
| E2E tests | Playwright | **1.60+** |
| i18n | react-i18next | Latest |
| CI/CD | GitHub Actions | Latest |

## Docker services

```yaml
postgres: postgres:18-alpine
redis:    redis:8-alpine
```

## Engine requirements

```json
{
  "engines": {
    "node": ">=26.0.0",
    "npm": ">=11.0.0"
  }
}
```

## Repo structure (target)

```
AnantaOne/
├── apps/
│   ├── api/        # Express 5 + Prisma + Socket.io
│   ├── web/        # React 19 + Vite 8 + Tailwind 4
│   └── mobile/     # Expo SDK 57
├── packages/
│   ├── shared/     # Zod schemas, types, constants
│   └── i18n/       # en.json, bn.json
├── docs/           # Project planning (this folder)
├── .github/workflows/
├── docker-compose.yml
└── turbo.json
```

## Bangladesh payments (integrate in Phase 2–3)

| Method | Integration |
|---|---|
| COD | Delivery confirmation |
| Manual bKash / Nagad / Rocket | TrxID + screenshot → staff verify |
| Company wallet | Ledger (double-entry) |
| SSLCommerz | Checkout + webhook |
| bKash Merchant API | Automated payment + webhook |
| Credit / due | Shop credit limit |

## Cloud dev tools

| Tool | Use |
|---|---|
| GitHub | Code source of truth |
| Cursor Cloud Agent | Code from mobile / any PC |
| Neon PostgreSQL | Cloud Agent DB (no Docker required) |
| Docker Compose | Local PC Postgres + Redis |

See [DATABASE.md](DATABASE.md) for Neon + migration rules.

## Install commands

### Cloud Agent (Neon or VM Postgres)

```bash
git checkout cloud-dev && git pull

# A) VM Postgres (no Neon):
bash scripts/setup-cloud-postgres.sh

# B) Or Neon — set DATABASE_URL + DIRECT_DATABASE_URL in .env
cp .env.example .env
cp apps/api/.env.example apps/api/.env

npm install
npm run db:migrate:deploy
npm run db:generate
npm run dev
```

### Local PC (Docker)

```bash
git clone https://github.com/Showrav88/AnantaOne.git
cd AnantaOne
git checkout local-dev
cp .env.example .env
cp apps/api/.env.example apps/api/.env
docker compose up -d
npm install
npm run db:migrate:deploy
npm run db:generate
npm run dev
```

## URLs (local dev)

| App | URL |
|---|---|
| Web | http://localhost:5173 |
| API | http://localhost:5000 |
| Mobile | Expo QR (Expo Go) |
