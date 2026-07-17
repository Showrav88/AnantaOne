# AnantaOne — Development Roadmap

## Phase 1 — Foundation (Week 1–2)

- [ ] Monorepo scaffold (`apps/api`, `apps/web`, `apps/mobile`)
- [ ] Docker Compose: PostgreSQL 18 + Redis 8
- [ ] Prisma schema: companies, users, roles, tenant base
- [ ] Auth: JWT + refresh + RBAC
- [ ] EN/BN i18n shell
- [ ] GitHub Actions CI (Node 26, lint, test, build)
- [ ] `npm run dev` starts all apps

## Phase 2 — Core business (Week 3–5)

- [ ] Product catalog (multi-product ready)
- [ ] Raw material + supplier management
- [ ] Production batches + R/O usage logging
- [ ] Inventory + stock movement log
- [ ] Real-time stock (Socket.io)
- [ ] Employee profiles + attendance

## Phase 3 — Buyer & orders (Week 6–8)

- [ ] B2B buyer registration + shop profiles
- [ ] Buyer portal (simple cart UI, Bengali default)
- [ ] Order management (status workflow)
- [ ] Post-order / backorder when stock low
- [ ] COD + manual bKash/Nagad/Rocket verify
- [ ] Company wallet ledger

## Phase 4 — Mobile + payments (Week 9–10)

- [ ] Expo mobile app (buyer + counter + delivery roles)
- [ ] SSLCommerz integration
- [ ] bKash Merchant API + webhooks
- [ ] Push / SMS notifications
- [ ] Low-stock alerts to owner

## Phase 5 — SaaS scale (Week 11–12)

- [ ] Multi-company signup + subscription plans
- [ ] Admin super-dashboard
- [ ] Reports: sales, production, stock, due collection
- [ ] Advanced audit logs
- [ ] Staging deploy on VPS

## Phase 6 — Future products (Month 4+)

- [ ] BOM / recipes per product (shampoo, soap, handwash)
- [ ] Quality control + batch expiry
- [ ] Distributor / franchise network
- [ ] Demand analytics + forecasting

---

## Cloud Agent instructions

When starting a Cloud Agent on mobile or web, use:

```
Repo: Showrav88/AnantaOne
Branch: cloud-dev (cloud) or local-dev (local PC)
Read: docs/STACK.md, docs/ARCHITECTURE.md, docs/ROADMAP.md
Continue from the first unchecked item in ROADMAP.md
Use latest stable versions only (see STACK.md)
Never commit .env files
Multi-tenant: tenant_id on all tables from day 1
UI: Bengali + English, mobile-first for buyers
```

---

## Daily dev workflow (any PC)

```bash
git checkout local-dev && git pull   # local PC
git checkout cloud-dev && git pull   # cloud agent
git checkout -b feature/my-task
# code...
git add . && git commit -m "message" && git push -u origin feature/my-task
# Merge to local-dev or cloud-dev via PR
```

---

## Current status

| Item | Status |
|---|---|
| GitHub repo | Done — `Showrav88/AnantaOne` |
| Docker compose (PG + Redis) | Done (starter) |
| Planning docs | Done |
| Monorepo scaffold | **Next** |
| CI pipeline | Pending |
| Production deploy | Pending |
