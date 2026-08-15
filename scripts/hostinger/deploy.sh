#!/usr/bin/env bash
# Build and deploy AnantaOne on Hostinger VPS (run as deploy user, not root).
# Usage (on VPS):
#   cd /var/www/anantaone
#   git pull origin local-dev   # or cloud-dev
#   bash scripts/hostinger/deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing $ROOT/.env — copy deploy/hostinger/env.production.example to .env"
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

echo "==> npm install"
npm ci

echo "==> Prisma generate + migrate"
npm run db:generate -w @anantaone/api
npm run db:migrate:deploy -w @anantaone/api

echo "==> Build API"
npm run build -w @anantaone/api

echo "==> Build web (same-origin API when VITE_API_URL is empty)"
export VITE_API_URL="${VITE_API_URL:-}"
npm run build -w @anantaone/web

echo "==> Restart API service"
if systemctl is-active --quiet anantaone-api 2>/dev/null; then
  sudo systemctl restart anantaone-api
else
  echo "Start once: sudo systemctl enable --now anantaone-api"
fi

echo "==> Reload nginx"
sudo nginx -t && sudo systemctl reload nginx

echo "Done. Check: curl -sS http://127.0.0.1:5000/health && curl -sS https://YOUR_DOMAIN/health"
