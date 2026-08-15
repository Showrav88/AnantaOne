#!/usr/bin/env bash
# Pull latest git and deploy if origin changed (for cron / manual run).
# Usage on VPS:
#   bash scripts/hostinger/auto-deploy.sh
# Env: DEPLOY_BRANCH=local-dev (default)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
BRANCH="${DEPLOY_BRANCH:-local-dev}"
LOG="${AUTO_DEPLOY_LOG:-/var/log/anantaone-auto-deploy.log}"

mkdir -p "$(dirname "$LOG")"

log() {
  echo "$(date -Is) $*" | tee -a "$LOG"
}

if [[ ! -f .env ]]; then
  log "ERROR: missing .env in $ROOT"
  exit 1
fi

git fetch origin "$BRANCH" 2>&1 | tee -a "$LOG"

LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"

if [[ "$LOCAL" == "$REMOTE" ]]; then
  log "No changes on origin/$BRANCH ($LOCAL)"
  exit 0
fi

log "Deploying $LOCAL -> $REMOTE (origin/$BRANCH)"
git pull origin "$BRANCH" 2>&1 | tee -a "$LOG"
bash "$ROOT/scripts/hostinger/deploy.sh" 2>&1 | tee -a "$LOG"
log "Auto-deploy finished OK"
