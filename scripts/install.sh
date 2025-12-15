#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="/opt/printer-ui"
APP_USER="${APP_USER:-$(logname 2>/dev/null || whoami)}"

log() { echo "[$(date -Is)] $*"; }

has_cmd() { command -v "$1" >/dev/null 2>&1; }

log "=== INSTALL START ==="
log "Source repo:  $PROJECT_DIR"
log "Target dir:  $TARGET_DIR"
log "App user:    $APP_USER"

# -------------------------------------------------
# 1) Docker automatisch installieren (falls fehlt)
# -------------------------------------------------
if ! has_cmd docker; then
  log "[1/8] Docker not found -> installing Docker (official repo)"

  sudo apt update
  sudo apt install -y ca-certificates curl gnupg

  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

  sudo apt update
  sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  sudo systemctl enable --now docker
else
  log "[1/8] Docker already installed"
fi

# -------------------------------------------------
# 2) docker compose plugin prüfen
# -------------------------------------------------
if ! docker compose version >/dev/null 2>&1; then
  log "ERROR: docker compose plugin missing even after install."
  exit 1
fi

# -------------------------------------------------
# 3) User in Docker-Gruppe (für docker ohne sudo)
# -------------------------------------------------
if ! groups "$APP_USER" | grep -q docker; then
  log "[2/8] Adding $APP_USER to docker group"
  sudo usermod -aG docker "$APP_USER"
  log "NOTE: Logout/Login required for docker group to apply."
else
  log "[2/8] User already in docker group"
fi

# -------------------------------------------------
# 4) Repo nach /opt spiegeln (falls du von woanders installierst)
#    Wenn du bereits in /opt/printer-ui bist, ist das ein No-Op.
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
# 5) Scripts ausführbar
# -------------------------------------------------
log "[4/8] Make scripts executable"
sudo chmod +x "$TARGET_DIR/scripts/"*.sh

# -------------------------------------------------
# 6) systemd Units installieren
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
# 7) sudoers Drop-in installieren
# -------------------------------------------------
log "[6/8] Install sudoers rule"
sudo install -m 0440 "$TARGET_DIR/sudoers/printer-ui-update" /etc/sudoers.d/printer-ui-update

# -------------------------------------------------
# 8) Docker Compose up
# -------------------------------------------------
log "[7/8] docker compose up -d"
cd "$TARGET_DIR"
docker compose up -d --remove-orphans

log "[8/8] Start services"
sudo systemctl start printer-ui.service || true
sudo systemctl start printer-ui-electron.service || true

log "=== INSTALL DONE ==="
log "If Docker was newly installed: log out and log back in once."
