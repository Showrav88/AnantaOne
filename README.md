# AnantaOne

PERN-based SaaS platform for distilled water production, inventory, B2B ordering, and Bangladesh payments.

## Stack

- **P**ostgreSQL · **E**xpress · **R**eact · **N**ode.js
- React Native (Expo) for mobile
- Redis + Socket.io for realtime stock

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

Use **GitHub as the single source of truth**. Work from any location (cloud VMs, remote agents, or local machines) by syncing through branches. The **cloud-dev** lane is fully cloud-based: remote-first, push often, continue the same branch from another environment.

### Branch strategy

| Branch | Purpose |
|---|---|
| `main` | Stable, deployable code |
| `develop` | Daily integration branch |
| `cloud-dev` | Full cloud-based working lane (multi-location / remote-first) |
| `feature/*` | One feature per branch (e.g. `feature/auth`, `feature/orders`) |

### Daily rules

1. **Pull before you start** — `git pull origin develop` (or your active cloud-dev / feature branch)
2. **Work on a dedicated branch** — never commit directly to `main`
3. **Push often** — keeps every location in sync
4. **Never commit `.env`** — secrets stay in each environment’s vars only
5. **No vendor traces in code** — do not add AI IDE names, logos, co-author trailers, or “made with” watermarks to source, commits, or product docs (see `.cursor/rules/cloud-dev.md`)

### Continue the same branch from another location

```bash
git checkout -b feature/my-work
# ... make changes ...
git add .
git commit -m "describe your change"
git push -u origin feature/my-work
```

On another machine or cloud environment:

```bash
git fetch origin
git checkout feature/my-work
git pull origin feature/my-work
```

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

## Git identity (AnantaOne — project branding only)

Set **local repo identity** once (only affects this project):

```bash
git config user.name "AnantaOne"
git config user.email "dev@anantaone.local"
git config core.hooksPath .githooks
```

This keeps commits under the **project name**, not a personal GitHub username in commit metadata.

## Strip third-party commit attribution

1. Turn off any IDE/git setting that appends co-author or “made with” trailers
2. Run `git config core.hooksPath .githooks` — the prepare-commit-msg hook strips known vendor attribution lines
3. If a remote agent still injects trailers server-side, amend or squash before merging to `main`
