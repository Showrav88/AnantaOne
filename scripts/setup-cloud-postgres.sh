#!/usr/bin/env bash
# Install PostgreSQL 18 on the Cloud Agent Ubuntu VM (no Neon, no Docker).
# Safe to re-run. Requires sudo.
set -euo pipefail

PG_VERSION="${PG_VERSION:-18}"
DB_USER="${DB_USER:-ananta}"
DB_PASS="${DB_PASS:-ananta123}"
DB_NAME="${DB_NAME:-anantaone}"

echo "==> Ensuring PostgreSQL ${PG_VERSION} apt source (PGDG)"
if [[ ! -f /etc/apt/sources.list.d/pgdg.list ]]; then
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | sudo gpg --dearmor -o /usr/share/keyrings/postgresql.gpg
  echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo "$VERSION_CODENAME")-pgdg main" \
    | sudo tee /etc/apt/sources.list.d/pgdg.list >/dev/null
fi

echo "==> Installing postgresql-${PG_VERSION}"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  "postgresql-${PG_VERSION}" "postgresql-client-${PG_VERSION}"

echo "==> Starting cluster (systemd may be unavailable in cloud VMs)"
if ! pg_lsclusters | awk -v v="$PG_VERSION" '$1==v && $2=="main" {print $4}' | grep -qx online; then
  sudo pg_ctlcluster "$PG_VERSION" main start
fi
pg_lsclusters

echo "==> Creating role + database"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
\\c ${DB_NAME}
GRANT ALL ON SCHEMA public TO ${DB_USER};
ALTER SCHEMA public OWNER TO ${DB_USER};
SQL

echo "==> Connection check"
PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT current_user, current_database(), version();"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
for envfile in "$ROOT_DIR/.env" "$ROOT_DIR/apps/api/.env"; do
  if [[ ! -f "$envfile" ]]; then
    example="${envfile}.example"
    if [[ -f "$example" ]]; then
      cp "$example" "$envfile"
      echo "==> Created $envfile from example"
    fi
  fi
done

echo
echo "Done. Local URL:"
echo "  postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
echo
echo "Next:"
echo "  npm install"
echo "  npm run db:migrate:deploy"
echo "  npm run db:generate"
echo "  npm run db:seed   # optional"
echo "  npm run dev"
echo
echo "If Postgres is down after a VM restart:"
echo "  sudo pg_ctlcluster ${PG_VERSION} main start"
