# AnantaOne — Hostinger VPS (KVM) deploy

Deploy on your **Hostinger VPS** with **PostgreSQL 18** already installed, **nginx**, and **Node.js 26**.

You do **not** need a local Postgres on your PC. The `P1000 ananta` error on Windows is normal until you point `.env` at a real database — run migrations **on the VPS only**.

---

## Architecture (one domain)

```
Browser  →  https://YOUR_DOMAIN
              ├── /          →  static files (apps/web/dist)
              └── /api/*     →  nginx proxy → Node API :5000
Postgres  →  127.0.0.1:5432/anantaone
```

Same domain = no CORS issues. Web app auto-uses `window.location.origin` for API when `VITE_API_URL` is empty.

---

## 1) VPS prerequisites

SSH into the VPS as root or sudo user.

### Node.js 26

```bash
curl -fsSL https://deb.nodesource.com/setup_26.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # v26.x
```

### Git + build tools

```bash
sudo apt-get update
sudo apt-get install -y git nginx certbot python3-certbot-nginx
```

### PostgreSQL 18 (already installed)

Check:

```bash
sudo -u postgres psql -c "SELECT version();"
```

---

## 2) Create database on VPS

```bash
cd /var/www
sudo git clone https://github.com/Showrav88/AnantaOne.git anantaone
cd anantaone
git checkout local-dev   # synced with cloud-dev

DB_PASS='Pick-A-Long-Random-Password' sudo -E bash scripts/hostinger/setup-postgres.sh
```

---

## 3) Environment file

```bash
sudo cp deploy/hostinger/env.production.example /var/www/anantaone/.env
sudo nano /var/www/anantaone/.env
```

Fill in:

| Key | Example |
|---|---|
| `APP_URL` | `https://shop.yourdomain.com` |
| `DATABASE_URL` | `postgresql://anantaone:PASSWORD@127.0.0.1:5432/anantaone` |
| `DIRECT_DATABASE_URL` | same as above |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | `openssl rand -hex 32` |
| `SUPER_ADMIN_EMAIL` | your email |
| `SUPER_ADMIN_PASSWORD` | strong password |
| `CLOUDINARY_URL` | from Cloudinary dashboard |
| `VITE_API_URL` | leave **empty** for same-domain nginx |

```bash
sudo chmod 600 /var/www/anantaone/.env
sudo chown -R www-data:www-data /var/www/anantaone
```

---

## 4) First deploy (build + migrate + seed)

```bash
cd /var/www/anantaone
sudo -u www-data bash -c 'source .env 2>/dev/null; npm ci'
sudo -u www-data npm run db:generate -w @anantaone/api
sudo -u www-data npm run db:migrate:deploy -w @anantaone/api
sudo -u www-data npm run db:seed -w @anantaone/api    # first time only
sudo -u www-data npm run build -w @anantaone/api
sudo -u www-data npm run build -w @anantaone/web
```

Or after `.env` exists:

```bash
bash scripts/hostinger/deploy.sh
sudo -u www-data npm run db:seed -w @anantaone/api   # first time only
```

---

## 5) systemd (API always running)

```bash
sudo cp deploy/hostinger/anantaone-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now anantaone-api
sudo systemctl status anantaone-api
curl -sS http://127.0.0.1:5000/health
```

Logs:

```bash
journalctl -u anantaone-api -f
```

---

## 6) nginx

Edit domain placeholder:

```bash
sudo cp deploy/hostinger/nginx-anantaone.conf /etc/nginx/sites-available/anantaone
sudo sed -i 's/YOUR_DOMAIN/shop.yourdomain.com/g' /etc/nginx/sites-available/anantaone
sudo ln -sf /etc/nginx/sites-available/anantaone /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### SSL (Let's Encrypt)

```bash
sudo certbot --nginx -d shop.yourdomain.com
```

Update `.env` `APP_URL` to `https://` and redeploy if you started with http.

### Second app on same VPS

If another site already uses nginx:

- Keep both configs in `sites-enabled/` with different `server_name`
- AnantaOne only listens on its own domain — no conflict

---

## 7) Verify live

```bash
curl -sS https://shop.yourdomain.com/health
curl -sS https://shop.yourdomain.com/health/db
```

Browser:

- `https://shop.yourdomain.com/#/login`
- `https://shop.yourdomain.com/#/owner`

---

## 8) Updates (after git pull on VPS)

```bash
cd /var/www/anantaone
git pull origin local-dev
bash scripts/hostinger/deploy.sh
```

---

## Windows PC — what to skip

| Do on PC | Do on VPS |
|---|---|
| `git pull` | `git pull`, build, migrate |
| Edit code | `.env`, nginx, systemd |
| **Skip** `db:migrate:deploy` without DB | **Run** migrate here |

Local `.env` with `ananta:ananta123@localhost` only works with Docker Postgres — not needed for Hostinger deploy.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `P1000 Authentication failed` for user `ananta` | Wrong local `.env` — use VPS `.env` with `anantaone` user from setup script |
| `/health/db` down | Check `DATABASE_URL`, Postgres running: `sudo systemctl status postgresql` |
| 502 Bad Gateway | API not running: `systemctl status anantaone-api` |
| CORS errors | Set `APP_URL` to exact browser URL (https, no trailing slash) |
| Upload fails | Set `CLOUDINARY_URL` on API `.env` |

---

## Files in repo

| Path | Purpose |
|---|---|
| `deploy/hostinger/nginx-anantaone.conf` | nginx site |
| `deploy/hostinger/anantaone-api.service` | systemd unit |
| `deploy/hostinger/env.production.example` | env template |
| `scripts/hostinger/setup-postgres.sh` | create DB user/db |
| `scripts/hostinger/deploy.sh` | build + migrate + restart |
