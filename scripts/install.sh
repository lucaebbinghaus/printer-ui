#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="/opt/printer-ui"
APP_USER="${APP_USER:-$(logname 2>/dev/null || whoami)}"

log() { echo "[$(date -Is)] $*"; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

log "=== INSTALL START ==="
log "Source repo:  $PROJECT_DIR"
log "Target dir:  $TARGET_DIR"
log "App user:    $APP_USER"

# -------------------------------------------------
# 1) Docker automatisch installieren (falls fehlt)
# -------------------------------------------------
if ! need_cmd docker; then
  log "[1/8] Docker not found → installing Docker"

  sudo apt update
  sudo apt install -y ca-certificates curl gnupg

  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg |
    sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" |
    sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

  sudo apt update
  sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

  sudo systemctl enable --now docker
else
  log "[1/8] Docker already installed"
fi

# -------------------------------------------------
# 2) User in Docker-Gruppe (falls nötig)
# -------------------------------------------------
if ! groups "$APP_USER" | grep -q docker; then
  log "[2/8] Adding $APP_USER to docker group"
  sudo usermod -aG docker "$APP_USER"
  log "⚠ Logout/Login required for docker group to apply"
else
  log "[2/8] User already in docker group"
fi

# -------------------------------------------------
# 3) Repo nach /opt spiegeln
# -------------------------------------------------
log "[3/8] Sync repo to $TARGET_DIR"
sudo mkdir -p "$TARGET_DIR"
sudo rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  "$PROJECT_DIR/" "$TARGET_DIR/"

sudo chown -R "$APP_USER:$APP_USER" "$TARGET_DIR"

# -------------------------------------------------
# 4) Scripts ausführbar
# -------------------------------------------------
log "[4/8] Make scripts executable"
sudo chmod +x "$TARGET_DIR/scripts/"*.sh

# -------------------------------------------------
# 5) systemd Services installieren
# -------------------------------------------------
log "[5/8] Install systemd units"
sudo install -m 0644 "$TARGET_DIR/systemd/printer-ui.service" /etc/systemd/system/printer-ui.service
sudo install -m 0644 "$TARGET_DIR/systemd/printer-ui-electron.service" /etc/systemd/system/printer-ui-electron.service
sudo install -m 0644 "$TARGET_DIR/systemd/printer-ui-update.service" /etc/systemd/system/printer-ui-update.service

sudo systemctl daemon-reload
sudo systemctl enable printer-ui.service
sudo systemctl enable printer-ui-electron.service
sudo systemctl enable printer-ui-update.service

# -------------------------------------------------
# 6) sudoers installieren
# -------------------------------------------------
log "[6/8] Install sudoers rule"
sudo install -m 0440 "$TARGET_DIR/sudoers/printer-ui-update" /etc/sudoers.d/printer-ui-update

# -------------------------------------------------
# 7) Docker Container starten
# -------------------------------------------------
log "[7/8] docker compose up -d"
cd "$TARGET_DIR"
docker compose up -d --remove-orphans

# -------------------------------------------------
# 8) Services starten
# -------------------------------------------------
log "[8/8] start services"
sudo systemctl start printer-ui.service || true
sudo systemctl start printer-ui-electron.service || true

log "=== INSTALL DONE ==="
log "If docker was just installed: log out and log back in once."
