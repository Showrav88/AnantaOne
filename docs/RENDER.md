# AnantaOne — Render deploy

Three services: **Static Site** (web) · **Web Service** (API) · **PostgreSQL** (database).

Deploy order: **Database → Web Service → Static Site**.

---

## 1) Database (Render PostgreSQL)

Dashboard → **New** → **PostgreSQL**

| Setting | Value |
|---|---|
| Name | `anantaone-db` |
| Database | `anantaone` |
| User | `anantaone` |
| Region | same as Web Service |
| Plan | Basic (or free if available) |

After create, open the DB → **Connections** → copy:

- **Internal Database URL** → use on Web Service as `DATABASE_URL` / `DIRECT_DATABASE_URL`
- (Optional) External URL — only for local laptop access

> Prefer Render Postgres **or** Neon. Do not commit either URL to Git.

---

## 2) Web Service (API — Express)

Dashboard → **New** → **Web Service** → connect `Showrav88/AnantaOne`

| Setting | Value |
|---|---|
| **Language** | Node |
| **Branch** | `cloud-dev` (or merged branch) |
| **Root Directory** | *(leave blank)* |
| **Build Command** | `npm install && npm run render:api:build` |
| **Start Command** | `npm run render:api:start` |
| **Instance** | Free / Starter |

### Environment variables (Web Service)

| Key | Value |
|---|---|
| `NODE_VERSION` | `26` |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Render Postgres URL + `?sslmode=require` |
| `DIRECT_DATABASE_URL` | **Same** as `DATABASE_URL` |
| `APP_URL` | Your Static Site URL, e.g. `https://anantaone-web.onrender.com` |
| `CORS_ORIGINS` | Optional extra origins, comma-separated |
| `JWT_SECRET` | long random string |
| `JWT_REFRESH_SECRET` | long random string |

**If build fails with `localhost:5432`:** Web Service env is missing `DATABASE_URL`. Paste External/Internal URL + `?sslmode=require`, save, redeploy.

Link the DB in Render (**Connect**) *and* confirm both env keys exist.

Health checks:

- `GET /health`
- `GET /health/db`

---

## 3) Static Site (web — Vite/React)

Dashboard → **New** → **Static Site**

| Setting | Value |
|---|---|
| **Root Directory** | *(leave blank)* |
| **Build Command** | `npm install && npm run build -w @anantaone/web` |
| **Publish Directory** | `apps/web/dist` |

### Environment variables (Static Site)

| Key | Value |
|---|---|
| `NODE_VERSION` | `26` |
| `VITE_API_URL` | Web Service URL, e.g. `https://anantaone-api.onrender.com` (no trailing slash) |

`VITE_*` vars are baked in at **build time**. After setting `VITE_API_URL`, click **Manual Deploy** (Clear cache) on the Static Site.

**If the site says “Waiting for API…”:** the browser cannot reach the API. Usually:
1. API Web Service failed to deploy / is sleeping / crashed  
2. Static Site was built **without** `VITE_API_URL` (defaults to `http://localhost:5000`)  
3. `APP_URL` on API does not match the Static Site URL (CORS)

Check in browser: open `https://YOUR-API.onrender.com/health` — must return `{"ok":true,...}`.

---

## Wire-up checklist

1. Create Postgres → copy Internal URL  
2. Create Web Service → set env → deploy → confirm `/health` and `/health/db`  
3. Create Static Site → set `VITE_API_URL` → deploy  
4. Set Web Service `APP_URL` to the Static Site URL → **Manual Deploy** API again (CORS)

---

## Local ↔ Render

| Place | DB |
|---|---|
| Cloud Agent VM | localhost Postgres (`scripts/setup-cloud-postgres.sh`) |
| Your PC | Docker Compose |
| Render | Render PostgreSQL or Neon |

Same Prisma migration files in Git — always `migrate deploy` on new DBs.
