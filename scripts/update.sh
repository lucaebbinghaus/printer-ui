#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/opt/printer-ui"
BRANCH="${UPDATE_BRANCH:-main}"
DATA_DIR="$PROJECT_DIR/data"
LOCK_FILE="$DATA_DIR/update.lock"

log() { echo "[$(date -Is)] $*"; }

mkdir -p "$DATA_DIR"

# Lock (verhindert parallele Updates)
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "Update already running, exit."
  exit 0
fi

cd "$PROJECT_DIR"

log "=== UPDATE START ==="
log "Project: $PROJECT_DIR"
log "Branch:  $BRANCH"

log "[1/8] git fetch"
git fetch --all --prune

CHANGED_FILES="$(git diff --name-only "HEAD..origin/$BRANCH" || true)"

if [[ -z "${CHANGED_FILES//[[:space:]]/}" ]]; then
  log "No changes detected. Nothing to do."
  log "=== UPDATE DONE (no-op) ==="
  exit 0
fi

log "Changes detected:"
echo "$CHANGED_FILES" | sed 's/^/ - /'

log "[2/8] git pull --ff-only"
git pull --ff-only origin "$BRANCH"

log "[3/8] update submodules"
git submodule sync --recursive
git submodule update --init --recursive

NEED_SYSTEMD=0
NEED_BUILD=0

# systemd changes?
if echo "$CHANGED_FILES" | grep -qE '^systemd/'; then
  NEED_SYSTEMD=1
fi

# rebuild if app/docker/scripts changed OR submodules changed
if echo "$CHANGED_FILES" | grep -qE '^(Dockerfile|docker-compose\.yml|app/|public/|scripts/|package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|zplbox/|opcua|services/)'; then
  NEED_BUILD=1
fi

if [[ "$NEED_SYSTEMD" == "1" ]]; then
  log "[4/8] Updating systemd units"
  sudo install -m 0644 systemd/printer-ui.service /etc/systemd/system/printer-ui.service
  sudo install -m 0644 systemd/printer-ui-electron.service /etc/systemd/system/printer-ui-electron.service
  sudo install -m 0644 systemd/printer-ui-update.service /etc/systemd/system/printer-ui-update.service
  sudo systemctl daemon-reload
fi

if [[ "$NEED_BUILD" == "1" ]]; then
  log "[5/8] docker compose build"
  docker compose build

  log "[6/8] docker compose up -d"
  docker compose up -d --remove-orphans
else
  log "[5/8] no rebuild needed"
fi

if [[ "$NEED_SYSTEMD" == "1" ]]; then
  log "[7/8] restart services"
  sudo systemctl restart printer-ui.service || true
  sudo systemctl restart printer-ui-electron.service || true
else
  log "[7/8] done"
fi

log "[8/8] finished"
log "=== UPDATE DONE ==="
