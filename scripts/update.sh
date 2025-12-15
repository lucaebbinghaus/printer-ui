#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/opt/printer-ui"
BRANCH="${UPDATE_BRANCH:-main}"
DATA_DIR="$PROJECT_DIR/data"
LOCK_FILE="$DATA_DIR/update.lock"

log() { echo "[$(date -Is)] $*"; }

mkdir -p "$DATA_DIR"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "Update already running, exit."
  exit 0
fi

cd "$PROJECT_DIR"

log "=== UPDATE START ==="
log "Branch: $BRANCH"

log "[1/8] git fetch"
git fetch --all --prune

CHANGED_FILES="$(git diff --name-only "HEAD..origin/$BRANCH" || true)"

if [[ -z "${CHANGED_FILES//[[:space:]]/}" ]]; then
  log "No changes detected"
  exit 0
fi

log "Changes detected:"
echo "$CHANGED_FILES" | sed 's/^/ - /'

log "[2/8] git pull"
git pull --ff-only origin "$BRANCH"

log "[3/8] submodules"
git submodule sync --recursive
git submodule update --init --recursive

NEED_SYSTEMD=0
NEED_BUILD=0

echo "$CHANGED_FILES" | grep -q '^systemd/' && NEED_SYSTEMD=1
echo "$CHANGED_FILES" | grep -qE '^(Dockerfile|docker-compose\.yml|app/|public/|scripts/|package\.json|.*lock|zplbox/|opcua|services/)' && NEED_BUILD=1

if [[ "$NEED_SYSTEMD" == "1" ]]; then
  log "[4/8] Render systemd units"

  # APP_USER laden
  if [[ -f /etc/default/printer-ui ]]; then
    source /etc/default/printer-ui
  fi
  APP_USER="${APP_USER:-$(logname 2>/dev/null || whoami)}"
  APP_USER_ESCAPED="$(printf '%s\n' "$APP_USER" | sed 's/[\/&]/\\&/g')"

  sed "s/@APP_USER@/$APP_USER_ESCAPED/g" \
    systemd/printer-ui.service.in \
    | sudo tee /etc/systemd/system/printer-ui.service >/dev/null

  sed "s/@APP_USER@/$APP_USER_ESCAPED/g" \
    systemd/printer-ui-electron.service.in \
    | sudo tee /etc/systemd/system/printer-ui-electron.service >/dev/null

  sed "s/@APP_USER@/$APP_USER_ESCAPED/g" \
    systemd/printer-ui-update.service.in \
    | sudo tee /etc/systemd/system/printer-ui-update.service >/dev/null

  sudo systemctl daemon-reload
fi

if [[ "$NEED_BUILD" == "1" ]]; then
  log "[5/8] docker compose build"
  docker compose build

  log "[6/8] docker compose up -d"
  docker compose up -d --remove-orphans
fi

if [[ "$NEED_SYSTEMD" == "1" ]]; then
  log "[7/8] restart services"
  sudo systemctl restart printer-ui.service || true
  sudo systemctl restart printer-ui-electron.service || true
fi

log "[8/8] UPDATE DONE"
