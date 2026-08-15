# Steps after .env — local Postgres on VPS + auto-deploy from git

You already created `.env` with **local VPS Postgres** (`127.0.0.1`).  
Password = what you set in `setup-postgres.sh` (e.g. `Pick-One-Strong-Password-123`).

---

## A) First deploy (SSH on VPS — run once)

```bash
cd /var/www/anantaone
git pull origin local-dev
```

### 1. Check `.env` looks like this

```env
NODE_ENV=production
PORT=5000
APP_URL=http://31.97.50.25
API_URL=http://31.97.50.25
VITE_API_URL=
DATABASE_URL=postgresql://anantaone:YOUR_VPS_DB_PASSWORD@127.0.0.1:5432/anantaone
DIRECT_DATABASE_URL=postgresql://anantaone:YOUR_VPS_DB_PASSWORD@127.0.0.1:5432/anantaone
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-secret-or-openssl-rand-hex-32
CLOUDINARY_URL=cloudinary://...
```

Test DB:

```bash
source .env
psql "$DATABASE_URL" -c "SELECT 1;"
```

Link `.env` for Prisma (required before migrate):

```bash
ln -sf /var/www/anantaone/.env /var/www/anantaone/apps/api/.env
```

If migrate still says DATABASE_URL missing, export then run:

```bash
set -a && source /var/www/anantaone/.env && set +a
npm run db:migrate:deploy -w @anantaone/api
```

Or after `git pull`, npm scripts use `node --env-file=../../.env` automatically.

### 2. Build + migrate + seed (first time only)

```bash
cd /var/www/anantaone
npm ci
npm run db:generate -w @anantaone/api
npm run db:migrate:deploy -w @anantaone/api
npm run db:seed -w @anantaone/api
npm run build -w @anantaone/api
npm run build -w @anantaone/web
```

Skip `db:seed` on later deploys.

### 3. API service (systemd)

```bash
sudo cp deploy/hostinger/anantaone-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now anantaone-api
curl http://127.0.0.1:5000/health
curl http://127.0.0.1:5000/health/db
```

Default service uses `User=root` and `node --env-file=/var/www/anantaone/.env` (more reliable than systemd `EnvironmentFile`).

If API won't start:

```bash
sudo systemctl status anantaone-api
sudo journalctl -u anantaone-api -n 40 --no-pager
# Manual test:
cd /var/www/anantaone
node --env-file=.env apps/api/dist/index.js
```

Ctrl+C after you see "API listening".

### 4. nginx

```bash
sudo cp deploy/hostinger/nginx-anantaone-ip.conf /etc/nginx/sites-available/anantaone
sudo sed -i 's/YOUR_VPS_IP/31.97.50.25/g' /etc/nginx/sites-available/anantaone
sudo ln -sf /etc/nginx/sites-available/anantaone /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Browser: http://31.97.50.25/#/login

---

## B) Auto-update VPS when you push to GitHub

Every **5 minutes** the VPS checks `origin/local-dev`. If you pushed new code, it pulls and runs `deploy.sh` (migrate + build + restart).

Install once on VPS:

```bash
cd /var/www/anantaone
sudo bash scripts/hostinger/install-auto-deploy-cron.sh
```

Log:

```bash
tail -f /var/log/anantaone-auto-deploy.log
```

Manual deploy anytime:

```bash
cd /var/www/anantaone
git pull origin local-dev
bash scripts/hostinger/deploy.sh
```

### Your workflow

1. **PC:** edit code → commit → `git push origin local-dev`
2. **VPS:** within ~5 minutes auto-deploy runs (or run `deploy.sh` manually)
3. Refresh http://31.97.50.25

---

## C) Port 5000

Internal only. If busy:

```bash
ss -tlnp | grep 5000
```

Change `PORT=5001` in `.env` and nginx `proxy_pass` to `5001`.

---

## D) Render

Separate from VPS. Local VPS DB = **new empty DB** until you seed. Render app can stay until you switch users to the IP.
