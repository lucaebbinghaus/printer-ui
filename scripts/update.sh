#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/opt/printer-ui"
BRANCH="${UPDATE_BRANCH:-main}"
DATA_DIR="$PROJECT_DIR/data"
LOCK_FILE="$DATA_DIR/update.lock"

log() { echo "[$(date -Is)] $*"; }

mkdir -p "$DATA_DIR"
cd "$PROJECT_DIR"

# -------------------------------------------------
# Lock
# -------------------------------------------------
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "Update already running"
  exit 0
fi

log "=== UPDATE START ==="

# -------------------------------------------------
# Git update (immutable working tree)
# -------------------------------------------------
OLD_HEAD="$(git rev-parse HEAD)"
git fetch --all --prune
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
git clean -fd

NEW_HEAD="$(git rev-parse HEAD)"

if [[ "$OLD_HEAD" == "$NEW_HEAD" ]]; then
  log "No changes"
  exit 0
fi

CHANGED_FILES="$(git diff --name-only "$OLD_HEAD..$NEW_HEAD")"
log "Changed files:"
echo "$CHANGED_FILES" | sed 's/^/ - /'

# -------------------------------------------------
# Flags
# -------------------------------------------------
NEED_DOCKER=0
NEED_ELECTRON_NPM=0
NEED_SYSTEMD_ELECTRON=0
NEED_SYSTEMD_BACKEND=0
NEED_SYSTEMD_UPDATE_API=0

echo "$CHANGED_FILES" | grep -qE '^(Dockerfile|docker-compose\.yml|app/|services/|public/)' && NEED_DOCKER=1
echo "$CHANGED_FILES" | grep -qE '^(package\.json|package-lock\.json|electron-app/)' && NEED_ELECTRON_NPM=1
echo "$CHANGED_FILES" | grep -qE '^systemd/system/printer-ui-electron' && NEED_SYSTEMD_ELECTRON=1
echo "$CHANGED_FILES" | grep -qE '^systemd/system/printer-ui\.service' && NEED_SYSTEMD_BACKEND=1
echo "$CHANGED_FILES" | grep -qE '^systemd/system/printer-ui-update-api' && NEED_SYSTEMD_UPDATE_API=1

APP_USER="$(. /etc/default/printer-ui; echo "$APP_USER")"
APP_USER_ESCAPED="$(printf '%s\n' "$APP_USER" | sed 's/[\/&]/\\&/g')"

# -------------------------------------------------
# systemd updates (SAFE)
# -------------------------------------------------
if [[ "$NEED_SYSTEMD_BACKEND" == "1" ]]; then
  log "Update backend systemd unit"
  sed "s/@APP_USER@/$APP_USER_ESCAPED/g" \
    systemd/system/printer-ui.service.in \
    | sudo tee /etc/systemd/system/printer-ui.service >/dev/null
fi

if [[ "$NEED_SYSTEMD_UPDATE_API" == "1" ]]; then
  log "Update update-api systemd unit"
  sudo cp systemd/system/printer-ui-update-api.service \
          /etc/systemd/system/printer-ui-update-api.service
fi

if [[ "$NEED_SYSTEMD_ELECTRON" == "1" ]]; then
  log "Update electron systemd unit"
  sed "s/@APP_USER@/$APP_USER_ESCAPED/g" \
    systemd/system/printer-ui-electron.service.in \
    | sudo tee /etc/systemd/system/printer-ui-electron.service >/dev/null
fi

if [[ "$NEED_SYSTEMD_BACKEND" == "1" || "$NEED_SYSTEMD_ELECTRON" == "1" || "$NEED_SYSTEMD_UPDATE_API" == "1" ]]; then
  sudo systemctl daemon-reload
fi

# -------------------------------------------------
# Electron deps
# -------------------------------------------------
if [[ "$NEED_ELECTRON_NPM" == "1" ]]; then
  log "npm install (electron)"
  sudo -u "$APP_USER" npm install
fi

# -------------------------------------------------
# Docker
# -------------------------------------------------
if [[ "$NEED_DOCKER" == "1" ]]; then
  log "Docker rebuild"
  docker compose build
  docker compose up -d --remove-orphans
fi

# -------------------------------------------------
# Restarts (explicit, safe)
# -------------------------------------------------
[[ "$NEED_SYSTEMD_UPDATE_API" == "1" ]] && sudo systemctl restart printer-ui-update-api.service
[[ "$NEED_SYSTEMD_ELECTRON" == "1" || "$NEED_ELECTRON_NPM" == "1" ]] && sudo systemctl restart printer-ui-electron.service
[[ "$NEED_SYSTEMD_BACKEND" == "1" ]] && sudo systemctl restart printer-ui.service

log "=== UPDATE DONE ==="
