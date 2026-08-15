#!/usr/bin/env bash
# Create AnantaOne database + role on local PostgreSQL 18 (Hostinger VPS).
# Run on the VPS: sudo bash scripts/hostinger/setup-postgres.sh
set -euo pipefail

DB_USER="${DB_USER:-anantaone}"
DB_NAME="${DB_NAME:-anantaone}"
DB_PASS="${DB_PASS:-}"

if [[ -z "$DB_PASS" ]]; then
  echo "Usage: DB_PASS='your-strong-password' sudo -E bash scripts/hostinger/setup-postgres.sh"
  exit 1
fi

echo "==> Creating role and database (user=$DB_USER db=$DB_NAME)"
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

echo
echo "Add to /var/www/anantaone/.env:"
echo "  DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
echo "  DIRECT_DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
