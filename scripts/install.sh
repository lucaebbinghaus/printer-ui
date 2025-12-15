#!/usr/bin/env bash
set -euo pipefail

# -------------------------------------------------
# Grundkonfiguration
# -------------------------------------------------
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
  log "[1/12] Docker not found → installing (official repo)"

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
  log "[1/12] Docker already installed"
fi

# docker compose Plugin prüfen
if ! docker compose version >/dev/null 2>&1; then
  log "ERROR: docker compose plugin missing"
  exit 1
fi

# -------------------------------------------------
# 2) User in docker-Gruppe
# -------------------------------------------------
if ! groups "$APP_USER" | grep -q docker; then
  log "[2/12] Adding $APP_USER to docker group"
  sudo usermod -aG docker "$APP_USER"
  log "NOTE: Logout/Login required for docker group to apply"
else
  log "[2/12] User already in docker group"
fi

# -------------------------------------------------
# 3) Repo nach /opt spiegeln (idempotent)
# -------------------------------------------------
log "[3/12] Sync repo to $TARGET_DIR"
sudo mkdir -p "$TARGET_DIR"
sudo rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  "$PROJECT_DIR/" "$TARGET_DIR/"

sudo chown -R "$APP_USER:$APP_USER" "$TARGET_DIR"

# -------------------------------------------------
# 4) Git Submodule holen (zplbox, opcua-client)
# -------------------------------------------------
log "[4/12] Update git submodules"
cd "$TARGET_DIR"
git submodule sync --recursive
git submodule update --init --recursive

# -------------------------------------------------
# 5) Scripts ausführbar machen
# -------------------------------------------------
log "[5/12] Make scripts executable"
sudo chmod +x "$TARGET_DIR/scripts/"*.sh

# -------------------------------------------------
# 6) systemd Units installieren (User einsetzen!)
# -------------------------------------------------
log "[6/12] Install systemd units (user substitution)"

APP_USER_ESCAPED="$(printf '%s\n' "$APP_USER" | sed 's/[\/&]/\\&/g')"

sed "s/@APP_USER@/$APP_USER_ESCAPED/g" \
  "$TARGET_DIR/systemd/printer-ui.service.in" \
  | sudo tee /etc/systemd/system/printer-ui.service >/dev/null

sed "s/@APP_USER@/$APP_USER_ESCAPED/g" \
  "$TARGET_DIR/systemd/printer-ui-electron.service.in" \
  | sudo tee /etc/systemd/system/printer-ui-electron.service >/dev/null

sed "s/@APP_USER@/$APP_USER_ESCAPED/g" \
  "$TARGET_DIR/systemd/printer-ui-update.service.in" \
  | sudo tee /etc/systemd/system/printer-ui-update.service >/dev/null

sudo systemctl daemon-reload
sudo systemctl enable printer-ui.service
sudo systemctl enable printer-ui-electron.service
sudo systemctl enable printer-ui-update.service

# -------------------------------------------------
# 7) sudoers Drop-In installieren
# -------------------------------------------------
log "[7/12] Install sudoers rule"
sudo install -m 0440 \
  "$TARGET_DIR/sudoers/printer-ui-update" \
  /etc/sudoers.d/printer-ui-update

# -------------------------------------------------
# 8) Docker Images bauen
# -------------------------------------------------
log "[8/12] docker compose build"
cd "$TARGET_DIR"
docker compose build

# -------------------------------------------------
# 9) Container starten
# -------------------------------------------------
log "[9/12] docker compose up -d"
docker compose up -d --remove-orphans

# -------------------------------------------------
# 10) systemd Services starten
# -------------------------------------------------
log "[10/12] Start services"
sudo systemctl restart printer-ui.service || true
sudo systemctl restart printer-ui-electron.service || true

# -------------------------------------------------
# 11) Status anzeigen
# -------------------------------------------------
log "[11/12] Service status"
systemctl --no-pager status printer-ui.service || true
systemctl --no-pager status printer-ui-electron.service || true

# -------------------------------------------------
# 12) Fertig
# -------------------------------------------------
log "[12/12] INSTALL DONE"
log "If Docker was newly installed: log out and log back in once."
