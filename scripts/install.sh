#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="/opt/printer-ui"
APP_USER="${APP_USER:-$(logname 2>/dev/null || whoami)}"

log() { echo "[$(date -Is)] $*"; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing dependency: $1"
    exit 1
  }
}

log "=== INSTALL START ==="
log "Source repo:  $PROJECT_DIR"
log "Target dir:  $TARGET_DIR"
log "App user:    $APP_USER"

need_cmd git
need_cmd sudo
need_cmd docker

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 plugin missing"
  exit 1
fi

# 1) Repo nach /opt spiegeln
log "[1/7] Sync repo to $TARGET_DIR"
sudo mkdir -p "$TARGET_DIR"
sudo rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  "$PROJECT_DIR/" "$TARGET_DIR/"

sudo chown -R "$APP_USER:$APP_USER" "$TARGET_DIR"

# 2) Scripts ausführbar
log "[2/7] Make scripts executable"
sudo chmod +x "$TARGET_DIR/scripts/"*.sh

# 3) systemd Services installieren
log "[3/7] Install systemd units"
sudo install -m 0644 "$TARGET_DIR/systemd/printer-ui.service" /etc/systemd/system/printer-ui.service
sudo install -m 0644 "$TARGET_DIR/systemd/printer-ui-electron.service" /etc/systemd/system/printer-ui-electron.service
sudo install -m 0644 "$TARGET_DIR/systemd/printer-ui-update.service" /etc/systemd/system/printer-ui-update.service
sudo systemctl daemon-reload
sudo systemctl enable printer-ui.service
sudo systemctl enable printer-ui-electron.service
sudo systemctl enable printer-ui-update.service

# 4) sudoers Drop-In installieren
log "[4/7] Install sudoers rule"
sudo install -m 0440 "$TARGET_DIR/sudoers/printer-ui-update" /etc/sudoers.d/printer-ui-update

# 5) Docker Container starten
log "[5/7] docker compose up -d"
cd "$TARGET_DIR"
docker compose up -d --remove-orphans

# 6) Services starten
log "[6/7] start services"
sudo systemctl start printer-ui.service || true
sudo systemctl start printer-ui-electron.service || true

# 7) Status
log "[7/7] status"
sudo systemctl status printer-ui.service --no-pager || true
sudo systemctl status printer-ui-electron.service --no-pager || true

log "=== INSTALL DONE ==="
