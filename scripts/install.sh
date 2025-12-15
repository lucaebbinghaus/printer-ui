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
  log "[1/14] Docker not found → installing (official repo)"

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
  log "[1/14] Docker already installed"
fi

# docker compose Plugin prüfen
if ! docker compose version >/dev/null 2>&1; then
  log "ERROR: docker compose plugin missing"
  exit 1
fi

# -------------------------------------------------
# 2) Node.js + npm + curl (Host) für Electron
# -------------------------------------------------
log "[2/14] Ensure nodejs/npm/curl installed (host)"
sudo apt update
sudo apt install -y nodejs npm curl

# -------------------------------------------------
# 3) User in docker-Gruppe
# -------------------------------------------------
if ! groups "$APP_USER" | grep -q docker; then
  log "[3/14] Adding $APP_USER to docker group"
  sudo usermod -aG docker "$APP_USER"
  log "NOTE: Logout/Login required for docker group to apply"
else
  log "[3/14] User already in docker group"
fi

# -------------------------------------------------
# 4) Repo nach /opt spiegeln (idempotent)
# -------------------------------------------------
log "[4/14] Sync repo to $TARGET_DIR"
sudo mkdir -p "$TARGET_DIR"
sudo rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  "$PROJECT_DIR/" "$TARGET_DIR/"

sudo chown -R "$APP_USER:$APP_USER" "$TARGET_DIR"

# -------------------------------------------------
# 5) Git Submodule holen
# -------------------------------------------------
log "[5/14] Update git submodules"
cd "$TARGET_DIR"
git submodule sync --recursive
git submodule update --init --recursive

# -------------------------------------------------
# 6) Scripts ausführbar machen
# -------------------------------------------------
log "[6/14] Make scripts executable"
sudo chmod +x "$TARGET_DIR/scripts/"*.sh || true
sudo chmod +x "$TARGET_DIR/electron-app/start.sh" || true

# -------------------------------------------------
# 7) Host Node dependencies installieren (für Electron)
# -------------------------------------------------
log "[7/14] Install Node dependencies on host (for Electron)"
cd "$TARGET_DIR"
sudo -u "$APP_USER" npm install

# -------------------------------------------------
# 8) Fix Electron chrome-sandbox (SUID) – sonst startet Electron nicht
# -------------------------------------------------
log "[8/14] Fix Electron chrome-sandbox permissions"
if [[ -f "$TARGET_DIR/node_modules/electron/dist/chrome-sandbox" ]]; then
  sudo chown root:root "$TARGET_DIR/node_modules/electron/dist/chrome-sandbox"
  sudo chmod 4755 "$TARGET_DIR/node_modules/electron/dist/chrome-sandbox"
else
  log "WARN: chrome-sandbox not found (electron not installed yet?)"
fi

# -------------------------------------------------
# 9) APP_USER zentral speichern
# -------------------------------------------------
log "[9/14] Write /etc/default/printer-ui"
sudo tee /etc/default/printer-ui >/dev/null <<EOF
APP_USER=$APP_USER
EOF
sudo chmod 0644 /etc/default/printer-ui

# -------------------------------------------------
# 10) systemd Units installieren (Backend + Update) aus Repo-Templates
# -------------------------------------------------
log "[10/14] Install systemd units (backend + update) from repo templates"

APP_USER_ESCAPED="$(printf '%s\n' "$APP_USER" | sed 's/[\/&]/\\&/g')"

# Backend
sed "s/@APP_USER@/$APP_USER_ESCAPED/g" \
  "$TARGET_DIR/systemd/printer-ui.service.in" \
  | sudo tee /etc/systemd/system/printer-ui.service >/dev/null

# Update
sed "s/@APP_USER@/$APP_USER_ESCAPED/g" \
  "$TARGET_DIR/systemd/printer-ui-update.service.in" \
  | sudo tee /etc/systemd/system/printer-ui-update.service >/dev/null

# Alten (falschen) Electron-Systemservice ggf. deaktivieren
if systemctl list-unit-files | grep -q '^printer-ui-electron\.service'; then
  log "[10/14] Disabling legacy system electron service"
  sudo systemctl disable --now printer-ui-electron.service || true
fi

sudo systemctl daemon-reload
sudo systemctl enable printer-ui.service
sudo systemctl enable printer-ui-update.service

# -------------------------------------------------
# 11) Electron als USER systemd service aus Repo installieren
#     Datei im Repo: systemd/user/printer-ui-electron.service.in
# -------------------------------------------------
log "[11/14] Install user systemd service for Electron (from repo)"

USER_UNIT_DIR="/home/$APP_USER/.config/systemd/user"
sudo mkdir -p "$USER_UNIT_DIR"

# optional substitution (falls @APP_USER@ im Template genutzt wird)
sed "s/@APP_USER@/$APP_USER_ESCAPED/g" \
  "$TARGET_DIR/systemd/user/printer-ui-electron.service.in" \
  | sudo tee "$USER_UNIT_DIR/printer-ui-electron.service" >/dev/null

sudo chown -R "$APP_USER:$APP_USER" "/home/$APP_USER/.config"

# User-Service beim Boot starten (ohne aktives SSH)
log "[11/14] Enable linger for $APP_USER"
sudo loginctl enable-linger "$APP_USER"

log "[11/14] Enable/start user electron service"
sudo -u "$APP_USER" systemctl --user daemon-reload
sudo -u "$APP_USER" systemctl --user enable --now printer-ui-electron.service

# -------------------------------------------------
# 12) Docker Images bauen + Container starten
# -------------------------------------------------
log "[12/14] docker compose build"
cd "$TARGET_DIR"
docker compose build

log "[12/14] docker compose up -d"
docker compose up -d --remove-orphans

# -------------------------------------------------
# 13) Backend systemd Service starten
# -------------------------------------------------
log "[13/14] Start backend service"
sudo systemctl restart printer-ui.service || true

# -------------------------------------------------
# 14) Status anzeigen
# -------------------------------------------------
log "[14/14] Status (system)"
systemctl --no-pager status printer-ui.service || true

log "[14/14] Status (user electron)"
sudo -u "$APP_USER" systemctl --user --no-pager status printer-ui-electron.service || true

log "=== INSTALL DONE ==="
log "If Docker was newly installed: log out and log back in once."
