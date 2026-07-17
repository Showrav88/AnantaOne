# AnantaOne — Cloud Agent Quick Start

Use this when coding from **mobile**, **cursor.com**, or **any PC**.

## Start Cloud Agent

1. Cursor → **Agents** → **New Cloud Agent**
2. Repo: **`Showrav88/AnantaOne`**
3. Branch: **`develop`**
4. Paste this prompt:

```
Build AnantaOne — a PERN SaaS for distilled water production in Bangladesh.

READ FIRST:
- docs/STACK.md       → latest tech versions (PG 18.4, Node 26, Express 5.2, React 19.2, Expo 57)
- docs/ARCHITECTURE.md → modules, multi-tenant, payments, EN/BN
- docs/ROADMAP.md     → what to build next

RULES:
- Latest stable versions only
- Multi-tenant (tenant_id on all tables)
- EN + Bengali i18n
- Never commit .env
- Mobile-first buyer UI
- Bangladesh payments: bKash, Nagad, Rocket, SSLCommerz, COD, wallet

START WITH: Monorepo scaffold (apps/api, apps/web, apps/mobile) if not done yet.
Then follow ROADMAP.md Phase 1 checklist.
```

## Why local chats don't show on mobile

| Chat type | Visible on mobile? |
|---|---|
| Desktop local chat | **No** — stored on PC only |
| Cloud Agent chat | **Yes** — syncs everywhere |

Always use **Cloud Agent** for mobile / web coding.

## Sync code between devices

```bash
git pull origin develop        # before starting
git push origin feature/xyz    # after finishing
```

GitHub is the single source of truth — not local chat history.
