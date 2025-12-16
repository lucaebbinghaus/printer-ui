#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"                 # run | check
PROJECT_DIR="/opt/printer-ui"
BRANCH="${UPDATE_BRANCH:-main}"
DATA_DIR="$PROJECT_DIR/data"
LOCK_FILE="$DATA_DIR/update.lock"

log() { echo "[$(date -Is)] $*"; }

mkdir -p "$DATA_DIR"
cd "$PROJECT_DIR"

# -------------------------------
# CHECK MODE (Host-only): JSON output for UI
# -------------------------------
if [[ "$MODE" == "check" ]]; then
  git fetch --all --prune >/dev/null 2>&1 || true

  HEAD="$(git rev-parse HEAD)"
  REMOTE="$(git rev-parse "origin/$BRANCH")"
  BEHIND="$(git rev-list --count "HEAD..origin/$BRANCH" || echo "0")"
  BEHIND="${BEHIND:-0}"

  if [[ "$BEHIND" == "0" ]]; then
    python3 - <<PY
import json
print(json.dumps({
  "ok": True,
  "branch": "$BRANCH",
  "head": "$HEAD",
  "remote": "$REMOTE",
  "behind": 0,
  "commits": [],
  "files": []
}))
PY
    exit 0
  fi

  COMMITS_RAW="$(git log --date=short --pretty=format:'%H%x09%ad%x09%an%x09%s' "HEAD..origin/$BRANCH" -n 50 || true)"
  FILES_RAW="$(git diff --name-only "HEAD..origin/$BRANCH" || true)"

  python3 - <<PY
import json
commits=[]
raw = """$COMMITS_RAW""".splitlines()
for line in raw:
  parts = line.split("\t", 3)
  if len(parts) != 4:
    continue
  sha, date, author, subject = parts
  commits.append({"sha": sha, "date": date, "author": author, "subject": subject})

files = [f for f in """$FILES_RAW""".splitlines() if f.strip()]

print(json.dumps({
  "ok": True,
  "branch": "$BRANCH",
  "head": "$HEAD",
  "remote": "$REMOTE",
  "behind": int("$BEHIND"),
  "commits": commits,
  "files": files
}))
PY
  exit 0
fi

# -------------------------------
# RUN MODE: Lock
# -------------------------------
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "Update already running, exit."
  exit 0
fi

log "=== UPDATE START ==="
log "Project: $PROJECT_DIR"
log "Branch:  $BRANCH"

# App-User laden (für Electron/Host npm falls noch benötigt)
APP_USER=""
if [[ -f /etc/default/printer-ui ]]; then
  # shellcheck disable=SC1091
  source /etc/default/printer-ui
fi
APP_USER="${APP_USER:-$(logname 2>/dev/null || whoami)}"
log "App user: $APP_USER"

OLD_HEAD="$(git rev-parse HEAD 2>/dev/null || echo "")"
if [[ -z "$OLD_HEAD" ]]; then
  log "ERROR: Cannot read current HEAD. Is this a git repo?"
  exit 1
fi

log "[1/10] git fetch"
git fetch --all --prune

log "[2/10] Force clean working tree (discard local changes)"
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
git clean -fd

NEW_HEAD="$(git rev-parse HEAD)"

if [[ "$OLD_HEAD" == "$NEW_HEAD" ]]; then
  log "No changes detected. Nothing to do."
  log "=== UPDATE DONE (no-op) ==="
  exit 0
fi

CHANGED_FILES="$(git diff --name-only "$OLD_HEAD..$NEW_HEAD" || true)"
log "Changes detected ($OLD_HEAD -> $NEW_HEAD):"
echo "$CHANGED_FILES" | sed 's/^/ - /'

log "[3/10] update submodules"
git submodule sync --recursive
git submodule update --init --recursive

NEED_BACKEND_SYSTEMD=0
NEED_UPDATE_API_SYSTEMD=0
NEED_ELECTRON_SYSTEMD=0
NEED_BUILD=0
NEED_HOST_NPM=0

# systemd system units (backend/update/electron)
echo "$CHANGED_FILES" | grep -qE '^systemd/system/printer-ui\.service(\.in)?$' && NEED_BACKEND_SYSTEMD=1
echo "$CHANGED_FILES" | grep -qE '^systemd/system/printer-ui-update-api\.service$' && NEED_UPDATE_API_SYSTEMD=1
echo "$CHANGED_FILES" | grep -qE '^systemd/system/printer-ui-electron\.service(\.in)?$' && NEED_ELECTRON_SYSTEMD=1

# host-api code changes -> restart update api service
echo "$CHANGED_FILES" | grep -qE '^host-api/' && NEED_UPDATE_API_SYSTEMD=1

# rebuild container if relevant files changed
echo "$CHANGED_FILES" | grep -qE '^(Dockerfile|docker-compose\.yml|app/|public/|services/|zplbox/|opcua|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)' && NEED_BUILD=1

# host npm install if node deps / electron files changed (nur falls du Electron host-seitig baust)
echo "$CHANGED_FILES" | grep -qE '^(package\.json|package-lock\.json|electron-app/)' && NEED_HOST_NPM=1

APP_USER_ESCAPED="$(printf '%s\n' "$APP_USER" | sed 's/[\/&]/\\&/g')"

# 4) backend systemd unit
if [[ "$NEED_BACKEND_SYSTEMD" == "1" ]]; then
  log "[4/10] Updating backend systemd unit"
  if [[ -f systemd/system/printer-ui.service.in ]]; then
    sed "s/@APP_USER@/$APP_USER_ESCAPED/g" systemd/system/printer-ui.service.in \
      | sudo tee /etc/systemd/system/printer-ui.service >/dev/null
  else
    sudo cp systemd/system/printer-ui.service /etc/systemd/system/printer-ui.service
  fi
  sudo systemctl daemon-reload
else
  log "[4/10] Backend systemd not changed"
fi

# 5) update host update-api service
if [[ "$NEED_UPDATE_API_SYSTEMD" == "1" ]]; then
  log "[5/10] Updating host update-api systemd unit"
  sudo cp systemd/system/printer-ui-update-api.service /etc/systemd/system/printer-ui-update-api.service
  sudo systemctl daemon-reload
  sudo systemctl enable printer-ui-update-api.service >/dev/null 2>&1 || true
  sudo systemctl restart printer-ui-update-api.service || true
else
  log "[5/10] Update API systemd not changed"
fi

# 6) electron systemd unit (system)
if [[ "$NEED_ELECTRON_SYSTEMD" == "1" ]]; then
  log "[6/10] Updating electron systemd unit (system)"
  if [[ -f systemd/system/printer-ui-electron.service.in ]]; then
    sed "s/@APP_USER@/$APP_USER_ESCAPED/g" systemd/system/printer-ui-electron.service.in \
      | sudo tee /etc/systemd/system/printer-ui-electron.service >/dev/null
  else
    sudo cp systemd/system/printer-ui-electron.service /etc/systemd/system/printer-ui-electron.service
  fi
  sudo systemctl daemon-reload
  sudo systemctl restart printer-ui-electron.service || true
else
  log "[6/10] Electron systemd not changed"
fi

# 7) host npm install (optional)
if [[ "$NEED_HOST_NPM" == "1" ]]; then
  log "[7/10] Host npm install (for Electron)"
  cd "$PROJECT_DIR"
  sudo -u "$APP_USER" npm install

  log "[7/10] Fix Electron chrome-sandbox permissions"
  if [[ -f "$PROJECT_DIR/node_modules/electron/dist/chrome-sandbox" ]]; then
    sudo chown root:root "$PROJECT_DIR/node_modules/electron/dist/chrome-sandbox"
    sudo chmod 4755 "$PROJECT_DIR/node_modules/electron/dist/chrome-sandbox"
  fi
else
  log "[7/10] Host npm install not needed"
fi

# 8) docker rebuild/up
if [[ "$NEED_BUILD" == "1" ]]; then
  log "[8/10] docker compose build"
  cd "$PROJECT_DIR"
  docker compose build --no-cache

  log "[8/10] docker compose up -d"
  docker compose up -d --remove-orphans
else
  log "[8/10] No docker rebuild needed"
fi

# 9) restart backend if needed
if [[ "$NEED_BACKEND_SYSTEMD" == "1" || "$NEED_BUILD" == "1" ]]; then
  log "[9/10] Restart backend service"
  sudo systemctl restart printer-ui.service || true
else
  log "[9/10] Backend restart not needed"
fi

log "[10/10] UPDATE DONE"
