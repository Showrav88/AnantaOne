# AnantaOne — Render deploy

Three services: **Static Site** (web) · **Web Service** (API) · **PostgreSQL** (database).

Deploy order: **Database → Web Service → Static Site**.

You can deploy from PR branch `Cloudenv-setup-neon-d75c` (no merge required). Set **Branch** to that name on both services.

---

## Your live URLs (current)

| Service | URL |
|---|---|
| Static Site | `https://anantaone.onrender.com` |
| Web Service (API) | `https://anantaoneapi.onrender.com` (**no hyphen**) |

> Important: Render names map to hostnames without extra hyphens.  
> Wrong: `https://anantaone-api.onrender.com` → 404 / fake CORS errors  
> Right: `https://anantaoneapi.onrender.com`

If the static page says **Waiting for API…** but `VITE_API_URL` is correct, the **API Web Service is not running**.  
`https://anantaoneapi.onrender.com/health` must return JSON `{"ok":true}` — if you see Render “Not Found” / `no-server`, fix the **Web Service** deploy (not the Static Site).

---

## 1) Database (Render PostgreSQL)

Dashboard → **New** → **PostgreSQL** (or use the one you already created).

Copy **External** or **Internal** Database URL.

---

## 2) Web Service (API) — this is what is broken right now

Dashboard → open service named like **anantaone-api** (type **Web Service**, not Static Site).

| Setting | Value |
|---|---|
| **Branch** | `Cloudenv-setup-neon-d75c` |
| **Root Directory** | *(leave blank)* |
| **Build Command** | `npm install && npm run render:api:build` |
| **Start Command** | `npm run render:api:start` |

`render:api:build` runs on **every deploy**:

1. `prisma generate`
2. `prisma migrate deploy`
3. `prisma db seed` (mock Lakshmipur shops — safe upserts)

### Environment (Web Service only — not Static Site)

| Key | Value |
|---|---|
| `NODE_VERSION` | `26` |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | your Render Postgres URL + `?sslmode=require` |
| `DIRECT_DATABASE_URL` | **same** as `DATABASE_URL` |
| `APP_URL` | `https://anantaone.onrender.com` |
| `JWT_SECRET` | long random string |
| `JWT_REFRESH_SECRET` | long random string |

Example (replace password; do not commit):

```text
DATABASE_URL=postgresql://USER:PASS@dpg-xxxxx-a.singapore-postgres.render.com/anantaonerender?sslmode=require
DIRECT_DATABASE_URL=postgresql://USER:PASS@dpg-xxxxx-a.singapore-postgres.render.com/anantaonerender?sslmode=require
APP_URL=https://anantaone.onrender.com
```

Then **Save** → **Manual Deploy**.

Build logs must show:
1. `DB env: set`
2. migration applied (or “No pending migrations”)
3. service starts (not stuck on `localhost:5432`)

Verify:

```text
https://anantaoneapi.onrender.com/
https://anantaoneapi.onrender.com/health
https://anantaoneapi.onrender.com/health/db
```

---

## 3) Static Site (already OK on your side)

| Setting | Value |
|---|---|
| **Branch** | `Cloudenv-setup-neon-d75c` |
| **Root Directory** | *(blank)* |
| **Build Command** | `npm install && npm run build -w @anantaone/web` |
| **Publish Directory** | `apps/web/dist` |

| Key | Value |
|---|---|
| `NODE_VERSION` | `26` |
| `VITE_API_URL` | `https://anantaoneapi.onrender.com` |

After API `/health` works, refresh the static site (rebuild only if you change `VITE_API_URL`).

---

## Wire-up checklist

1. Postgres URL set on **Web Service** env  
2. Web Service deploy green → `/health` OK  
3. Static Site `VITE_API_URL` points at API  
4. Web Service `APP_URL=https://anantaone.onrender.com`
