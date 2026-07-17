# AnantaOne

PERN-based SaaS platform for distilled water production, inventory, B2B ordering, and Bangladesh payments.

## Stack (latest stable — July 2026)

- **P**ostgreSQL **18.4** · **E**xpress **5.2** · **R**eact **19.2** · **N**ode.js **26**
- TypeScript **7.0** · Vite **8** · Prisma **7.8** · Expo SDK **57**
- Redis **8** · Tailwind **4** · Socket.io for realtime stock

## Project docs

| Doc | Purpose |
|---|---|
| [docs/STACK.md](docs/STACK.md) | Locked tech versions |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Modules, SaaS design, payments |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Build phases + checklist |
| [docs/CLOUD-AGENT.md](docs/CLOUD-AGENT.md) | Start coding from mobile/cloud |

## Quick start (local)

```bash
# 1. Clone
git clone https://github.com/Showrav88/AnantaOne.git
cd AnantaOne

# 2. Environment
cp .env.example .env

# 3. Database & cache
docker compose up -d

# 4. Install & run (after apps are scaffolded)
npm install
npm run dev
```

## Cloud + local workflow

Use **GitHub as the single source of truth**. Work on cloud (Cursor Cloud Agent) and local at the same time by syncing through branches.

### Branch strategy

| Branch | Purpose |
|---|---|
| `main` | Stable, deployable code |
| `develop` | Daily integration branch |
| `feature/*` | One feature per branch (e.g. `feature/auth`, `feature/orders`) |

### Daily rules

1. **Pull before you start** — `git pull origin develop`
2. **Work on a feature branch** — never commit directly to `main`
3. **Push often** — keeps cloud and local in sync
4. **Never commit `.env`** — secrets stay local / cloud env vars only

### Local → Cloud

```bash
git checkout -b feature/my-work
# ... make changes ...
git add .
git commit -m "describe your change"
git push -u origin feature/my-work
```

Open a **Cursor Cloud Agent** on the same repo + branch to continue there.

### Cloud → Local

```bash
git fetch origin
git checkout feature/my-work
git pull origin feature/my-work
```

### Cursor Cloud Agent

1. Push your branch to GitHub
2. In Cursor: **Agents → New Cloud Agent**
3. Select repo: `Showrav88/AnantaOne`
4. Pick the same branch you use locally
5. Cloud agent edits → commit → push → pull locally

## Repo structure (planned)

```
anantaone/
├── apps/
│   ├── api/        # Express + TypeScript
│   ├── web/        # React admin + buyer portal
│   └── mobile/     # Expo app
├── packages/
│   ├── shared/     # Types, validators
│   └── i18n/       # EN / BN translations
├── docker-compose.yml
└── .env.example
```

## Remote

```bash
git remote -v
# origin  https://github.com/Showrav88/AnantaOne.git
```

## Git identity (AnantaOne — not personal account branding)

Set **local repo identity** once (only affects this project):

```bash
git config user.name "AnantaOne"
git config user.email "dev@anantaone.local"
git config core.hooksPath .githooks
```

This keeps commits under the **project name**, not your personal GitHub username in commit metadata.

## Disable Cursor co-author on commits

1. **Cursor Settings → Git & PRs → Attribution** → turn **OFF**
2. Run `git config core.hooksPath .githooks` (see above) — strips any Cursor co-author lines locally
3. Cloud Agent may still add co-author server-side; pull locally and amend/squash before merging to `main` if needed
