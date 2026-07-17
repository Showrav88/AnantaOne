# AnantaOne — Architecture

## Business context

AnantaOne is a **PERN SaaS platform** for a distilled water production company in **Lakshmipur, Bangladesh**.

### Current operations

- Raw materials (acid, acid linisc) sourced from **Chittagong**, transported to Lakshmipur
- **R/O pump** production for:
  - Battery water (mineral mix)
  - Drinking water
- B2B distribution to local shops

### Future scope (design for this from day 1)

- Multi-product manufacturing: shampoo, soap, handwash, etc.
- Multi-company SaaS (many factories, many counters, many workers)
- Scale like a multinational over 3–5 years

## User roles

| Role | Access |
|---|---|
| Owner | Full admin, reports, payments approve |
| Manager | Production, inventory, staff |
| Counter staff | POS orders, stock check, payment verify |
| Production staff | Batch logging, raw material usage |
| Delivery | Dispatch, COD collection |
| Buyer (shop owner) | Order portal, wallet, track delivery |

## Core modules

### 1. Multi-tenant SaaS base

- `tenant_id` on every table
- Company → branches → counters → users
- JWT auth + RBAC
- Audit log (`created_by`, `updated_by`, timestamp)

### 2. Product catalog

- Categories, SKUs, units (L, bottle, drum)
- Variants, pricing per buyer tier
- Product types: water, chemical, consumer goods (future)

### 3. Raw material & production

- Suppliers (e.g. Chittagong)
- Purchase orders, transport cost
- Production batches linked to R/O usage
- Wastage tracking
- BOM / recipes (Phase 3 — for shampoo, soap, etc.)

### 4. Inventory (real-time)

- Warehouse stock + counter stock
- States: `available`, `reserved`, `in_production`, `backordered`
- Min stock alerts
- Socket.io live updates

### 5. HR

- Employee profiles
- Attendance (check-in/out, shifts)
- Salary basics
- Audit trail

### 6. B2B buyer portal

- Simple UI for non-tech shop owners
- Product cards → cart → checkout
- Bengali default, English toggle
- Phone OTP login
- Order status: Ordered → Confirmed → Out for delivery → Delivered

### 7. Orders & post-orders

- Normal order when stock available
- **Post-order / backorder** when stock low but buyer needs more
- Owner notified in real-time
- Auto-fulfill when restocked

### 8. Payments & wallet

- COD, manual mobile banking, wallet, SSLCommerz, bKash API
- Wallet ledger (every credit/debit has reference ID)
- Shop credit limit / due tracking

### 9. i18n

- English + Bengali (`react-i18next`)
- Noto Sans Bengali font
- Test on low-end Android

## Multi-tenant data model (simplified)

```
companies (tenant)
  ├── branches
  ├── counters
  ├── users (employees)
  ├── products
  ├── inventory_movements
  ├── buyers (B2B shops)
  ├── orders
  │     └── order_items
  ├── payments
  └── wallet_transactions
```

## Real-time stock + post-order flow

```
Buyer orders 100 bottles
  → Available stock = 60
  → 60 delivered now + 40 post-order (backordered)
  → Owner gets Socket.io alert
  → Production/restock
  → Backorder auto-fulfilled
  → Buyer notified
```

## System diagram

```
[Buyer Portal / Mobile App]
         ↓
    [Express API]
    ↙    ↓    ↘
[PostgreSQL] [Redis] [Socket.io]
                  ↓
              [BullMQ Jobs]
                  ↓
         [SMS / Payment webhooks]
```

## Security rules

- Never commit `.env`
- Tenant isolation on every API query
- Payment verify requires staff role
- Rate limit auth endpoints
- HTTPS only in production

## Git workflow

| Branch | Purpose |
|---|---|
| `main` | Production |
| `develop` | Daily integration |
| `feature/*` | One feature per branch |

GitHub repo: `Showrav88/AnantaOne`
