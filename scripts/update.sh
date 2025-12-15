#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/opt/printer-ui"
BRANCH="${UPDATE_BRANCH:-main}"
DATA_DIR="$PROJECT_DIR/data"
LOCK_FILE="$DATA_DIR/update.lock"

log() { echo "[$(date -Is)] $*"; }

mkdir -p "$DATA_DIR"

# -------------------------------------------------
# Lock (verhindert parallele Updates)
# -------------------------------------------------
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "Update already running, exit."
  exit 0
fi

cd "$PROJECT_DIR"

log "=== UPDATE START ==="
log "Project: $PROJECT_DIR"
log "Branch:  $BRANCH"

# -------------------------------------------------
# App-User laden (für User-Service Restart)
# -------------------------------------------------
APP_USER=""
if [[ -f /etc/default/printer-ui ]]; then
  # shellcheck disable=SC1091
  source /etc/default/printer-ui
fi
APP_USER="${APP_USER:-$(logname 2>/dev/null || whoami)}"
APP_UID="$(id -u "$APP_USER" 2>/dev/null || echo "")"

log "App user: $APP_USER (uid=${APP_UID:-?})"

# -------------------------------------------------
# 1) Fetch / Diff
# -------------------------------------------------
log "[1/10] git fetch"
git fetch --all --prune

CHANGED_FILES="$(git diff --name-only "HEAD..origin/$BRANCH" || true)"
if [[ -z "${CHANGED_FILES//[[:space:]]/}" ]]; then
  log "No changes detected. Nothing to do."
  log "=== UPDATE DONE (no-op) ==="
  exit 0
fi

log "Changes detected:"
echo "$CHANGED_FILES" | sed 's/^/ - /'

# -------------------------------------------------
# 2) Pull
# -------------------------------------------------
log "[2/10] git pull --ff-only"
git pull --ff-only origin "$BRANCH"

# -------------------------------------------------
# 3) Submodules
# -------------------------------------------------
log "[3/10] update submodules"
git submodule sync --recursive
git submodule update --init --recursive

NEED_SYSTEMD=0
NEED_USER_SYSTEMD=0
NEED_BUILD=0
NEED_HOST_NPM=0

# systemd (system)
if echo "$CHANGED_FILES" | grep -qE '^systemd/(printer-ui\.service\.in|printer-ui-update\.service\.in)'; then
  NEED_SYSTEMD=1
fi

# systemd (user)
if echo "$CHANGED_FILES" | grep -qE '^systemd/user/'; then
  NEED_USER_SYSTEMD=1
fi

# rebuild container if app/docker/services changed OR submodules changed
if echo "$CHANGED_FILES" | grep -qE '^(Dockerfile|docker-compose\.yml|app/|public/|services/|zplbox/|opcua|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)'; then
  NEED_BUILD=1
fi

# host npm install if node deps or electron relevant files changed
if echo "$CHANGED_FILES" | grep -qE '^(package\.json|package-lock\.json|electron-app/|electron/|preload\.js|main\.js)'; then
  NEED_HOST_NPM=1
fi

# -------------------------------------------------
# 4) Systemd system-units rendern (falls geändert)
# -------------------------------------------------
if [[ "$NEED_SYSTEMD" == "1" ]]; then
  log "[4/10] Updating systemd system units (render from .in)"

  APP_USER_ESCAPED="$(printf '%s\n' "$APP_USER" | sed 's/[\/&]/\\&/g')"

  sed "s/@APP_USER@/$APP_USER_ESCAPED/g" \
    systemd/printer-ui.service.in \
    | sudo tee /etc/systemd/system/printer-ui.service >/dev/null

  sed "s/@APP_USER@/$APP_USER_ESCAPED/g" \
    systemd/printer-ui-update.service.in \
    | sudo tee /etc/systemd/system/printer-ui-update.service >/dev/null

  sudo systemctl daemon-reload
fi

# -------------------------------------------------
# 5) User-unit (Electron) installieren (falls geändert)
# -------------------------------------------------
if [[ "$NEED_USER_SYSTEMD" == "1" ]]; then
  log "[5/10] Updating user systemd unit (Electron)"

  USER_UNIT_DIR="/home/$APP_USER/.config/systemd/user"
  sudo mkdir -p "$USER_UNIT_DIR"

  APP_USER_ESCAPED="$(printf '%s\n' "$APP_USER" | sed 's/[\/&]/\\&/g')"
  sed "s/@APP_USER@/$APP_USER_ESCAPED/g" \
    systemd/user/printer-ui-electron.service.in \
    | sudo tee "$USER_UNIT_DIR/printer-ui-electron.service" >/dev/null

  sudo chown -R "$APP_USER:$APP_USER" "/home/$APP_USER/.config"
fi

# -------------------------------------------------
# 6) Host npm install (Electron läuft auf Host)
# -------------------------------------------------
if [[ "$NEED_HOST_NPM" == "1" ]]; then
  log "[6/10] Host npm install (for Electron)"
  cd "$PROJECT_DIR"
  sudo -u "$APP_USER" npm install

  log "[6/10] Fix Electron chrome-sandbox permissions"
  if [[ -f "$PROJECT_DIR/node_modules/electron/dist/chrome-sandbox" ]]; then
    sudo chown root:root "$PROJECT_DIR/node_modules/electron/dist/chrome-sandbox"
    sudo chmod 4755 "$PROJECT_DIR/node_modules/electron/dist/chrome-sandbox"
  else
    log "WARN: chrome-sandbox not found"
  fi
else
  log "[6/10] Host npm install not needed"
fi

# -------------------------------------------------
# 7) Docker Build/Up (Backend)
# -------------------------------------------------
if [[ "$NEED_BUILD" == "1" ]]; then
  log "[7/10] docker compose build"
  cd "$PROJECT_DIR"
  docker compose build

  log "[7/10] docker compose up -d"
  docker compose up -d --remove-orphans
else
  log "[7/10] No docker rebuild needed"
fi

# -------------------------------------------------
# 8) system service restart (Backend) falls systemd geändert wurde
# -------------------------------------------------
if [[ "$NEED_SYSTEMD" == "1" ]]; then
  log "[8/10] Restart backend service"
  sudo systemctl restart printer-ui.service || true
else
  log "[8/10] Backend service restart not required"
fi

# -------------------------------------------------
# 9) User service restart (Electron) falls nötig und Bus verfügbar
# -------------------------------------------------
log "[9/10] Restart user electron service (if available)"
USER_BUS=""
if [[ -n "${APP_UID:-}" && -S "/run/user/$APP_UID/bus" ]]; then
  # Versuche in echter User-Session zu laufen (robust)
  if command -v machinectl >/dev/null 2>&1; then
    sudo machinectl shell "$APP_USER"@ /bin/bash -lc \
      'systemctl --user daemon-reload && systemctl --user restart printer-ui-electron.service' \
      || true
  else
    # Fallback: XDG_RUNTIME_DIR setzen
    sudo -u "$APP_USER" XDG_RUNTIME_DIR="/run/user/$APP_UID" systemctl --user daemon-reload || true
    sudo -u "$APP_USER" XDG_RUNTIME_DIR="/run/user/$APP_UID" systemctl --user restart printer-ui-electron.service || true
  fi
else
  log "User bus not available; skipping electron restart (will start on next user session)."
fi

# -------------------------------------------------
# 10) Done
# -------------------------------------------------
log "[10/10] finished"
log "=== UPDATE DONE ==="
