#!/usr/bin/env bash
# Install cron job: check git every 5 minutes and deploy if local-dev changed.
# Run on VPS once: sudo bash scripts/hostinger/install-auto-deploy-cron.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEPLOY_USER="${SUDO_USER:-${USER:-root}}"
CRON_LINE="*/5 * * * * cd $ROOT && DEPLOY_BRANCH=local-dev bash $ROOT/scripts/hostinger/auto-deploy.sh"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run with sudo: sudo bash scripts/hostinger/install-auto-deploy-cron.sh"
  exit 1
fi

touch /var/log/anantaone-auto-deploy.log
chown "$DEPLOY_USER:$DEPLOY_USER" /var/log/anantaone-auto-deploy.log 2>/dev/null || true

# Remove old anantaone auto-deploy lines, append fresh one
(crontab -u "$DEPLOY_USER" -l 2>/dev/null | grep -v 'anantaone-auto-deploy\|scripts/hostinger/auto-deploy.sh' || true
 echo "$CRON_LINE") | crontab -u "$DEPLOY_USER" -

echo "Installed cron for user: $DEPLOY_USER"
echo "  Every 5 min: git fetch → pull local-dev → deploy if changed"
echo "  Log: /var/log/anantaone-auto-deploy.log"
echo "  Test now:  cd $ROOT && bash scripts/hostinger/auto-deploy.sh"
crontab -u "$DEPLOY_USER" -l | grep auto-deploy || true
