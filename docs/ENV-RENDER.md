# Env cheat-sheet (Render)

These are **not** all the same.

## Static Site (`anantaone`)

| Key | Must be |
|---|---|
| `VITE_API_URL` | `https://anantaoneapi.onrender.com` |

No hyphen. Wrong host `anantaone-api` returns Render 404 (looks like CORS in browser).

After changing this → **Manual Deploy + Clear build cache**.

## Web Service (`AnantaOneApi` → `anantaoneapi.onrender.com`)

| Key | Must be |
|---|---|
| `APP_URL` | `https://anantaone.onrender.com` |
| `DATABASE_URL` | Internal Postgres URL + `?sslmode=require` |
| `DIRECT_DATABASE_URL` | **same as** `DATABASE_URL` |
| `NODE_VERSION` | `26` |
| `NODE_ENV` | `production` |
| `CLOUDINARY_URL` | `cloudinary://<api_key>:<api_secret>@dtd4hpmjb` on **API** service only — no quotes (see `docs/CLOUDINARY.md`) |
| *(or)* `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET` | Alternative to `CLOUDINARY_URL` |

### Postgres examples

Internal (preferred on Web Service):

```text
postgresql://USER:PASS@dpg-xxxxx-a/anantaonerender?sslmode=require
```

External (laptop only):

```text
postgresql://USER:PASS@dpg-xxxxx-a.singapore-postgres.render.com/anantaonerender?sslmode=require
```

## Quick verify

```text
https://anantaoneapi.onrender.com/health
https://anantaoneapi.onrender.com/health/db
https://anantaoneapi.onrender.com/api/v1/buyers
```

If those work but the UI does not: hard refresh / clear site data — old JS may still call `anantaone-api`.
