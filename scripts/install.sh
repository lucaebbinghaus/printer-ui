#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="/opt/printer-ui"
APP_USER="${APP_USER:-$(logname 2>/dev/null || whoami)}"

log() { echo "[$(date -Is)] $*"; }
has_cmd() { command -v "$1" >/dev/null 2>&1; }

log "=== INSTALL START ==="
log "Source repo:  $PROJECT_DIR"
log "Target dir:   $TARGET_DIR"
log "App user:     $APP_USER"

# -------------------------------------------------
# 1) Docker
# -------------------------------------------------
if ! has_cmd docker; then
  log "[1/10] Installing Docker"
  sudo apt update
  sudo apt install -y ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt update
  sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  sudo systemctl enable --now docker
else
  log "[1/10] Docker already installed"
fi

# -------------------------------------------------
# 2) Node.js (Host API + Electron)
# -------------------------------------------------
if ! has_cmd node; then
  log "[2/10] Installing Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

# -------------------------------------------------
# 3) Sync Repo → /opt
# -------------------------------------------------
log "[3/10] Sync repo to $TARGET_DIR"
sudo mkdir -p "$TARGET_DIR"
sudo rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  "$PROJECT_DIR/" "$TARGET_DIR/"

sudo chown -R "$APP_USER:$APP_USER" "$TARGET_DIR"

# -------------------------------------------------
# 4) Submodules
# -------------------------------------------------
log "[4/10] Submodules"
cd "$TARGET_DIR"
git submodule sync --recursive
git submodule update --init --recursive

# -------------------------------------------------
# 5) Executable scripts
# -------------------------------------------------
log "[5/10] Permissions"
sudo chmod +x "$TARGET_DIR/scripts/"*.sh || true
sudo chmod +x "$TARGET_DIR/electron-app/start.sh" || true

# -------------------------------------------------
# 6) Host npm install (Electron)
# -------------------------------------------------
log "[6/10] npm install"
cd "$TARGET_DIR"
sudo -u "$APP_USER" npm install

# Electron sandbox
if [[ -f node_modules/electron/dist/chrome-sandbox ]]; then
  sudo chown root:root node_modules/electron/dist/chrome-sandbox
  sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
fi

# -------------------------------------------------
# 7) Persist APP_USER
# -------------------------------------------------
log "[7/10] Write /etc/default/printer-ui"
sudo tee /etc/default/printer-ui >/dev/null <<EOF
APP_USER=$APP_USER
EOF

APP_USER_ESCAPED="$(printf '%s\n' "$APP_USER" | sed 's/[\/&]/\\&/g')"

# -------------------------------------------------
# 8) Install systemd SYSTEM units
# -------------------------------------------------
log "[8/10] Install systemd units"

# Docker backend
sed "s/@APP_USER@/$APP_USER_ESCAPED/g" \
  "$TARGET_DIR/systemd/system/printer-ui.service.in" \
  | sudo tee /etc/systemd/system/printer-ui.service >/dev/null

# Host update API (Node)
sudo cp "$TARGET_DIR/systemd/system/printer-ui-update-api.service" \
        /etc/systemd/system/printer-ui-update-api.service

# Electron (X11 system service)
sed "s/@APP_USER@/$APP_USER_ESCAPED/g" \
  "$TARGET_DIR/systemd/system/printer-ui-electron.service.in" \
  | sudo tee /etc/systemd/system/printer-ui-electron.service >/dev/null

# -------------------------------------------------
# 9) Cleanup legacy services
# -------------------------------------------------
log "[9/10] Cleanup legacy units"
sudo systemctl disable --now printer-ui-updater.service 2>/dev/null || true
sudo systemctl disable --now printer-ui-update.service  2>/dev/null || true
sudo systemctl disable --now printer-ui-api.service     2>/dev/null || true
sudo rm -f /etc/systemd/system/printer-ui-updater.service
sudo rm -f /etc/systemd/system/printer-ui-update.service
sudo rm -f /etc/systemd/system/printer-ui-api.service

sudo systemctl daemon-reload

# Enable services
sudo systemctl enable --now printer-ui.service
sudo systemctl enable --now printer-ui-update-api.service
sudo systemctl enable --now printer-ui-electron.service

# -------------------------------------------------
# 10) Docker up
# -------------------------------------------------
log "[10/10] Docker up"
cd "$TARGET_DIR"
docker compose up -d --remove-orphans

log "=== INSTALL DONE ==="
