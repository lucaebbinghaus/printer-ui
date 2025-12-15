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
# 1) Docker installieren (falls fehlt)
# -------------------------------------------------
if ! has_cmd docker; then
  log "[1/15] Docker not found → installing (official repo)"

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
  log "[1/15] Docker already installed"
fi

if ! docker compose version >/dev/null 2>&1; then
  log "ERROR: docker compose plugin missing"
  exit 1
fi

# -------------------------------------------------
# 2) Host Dependencies: node/npm/curl/python3
# -------------------------------------------------
sudo apt install -y curl python3

# Node über NodeSource (npm ist enthalten, KEIN apt npm installieren)
if ! command -v node >/dev/null 2>&1; then
  log "[2/15] Installing Node.js 20 (NodeSource)"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

log "[2/15] Node: $(node -v 2>/dev/null || echo missing)  NPM: $(npm -v 2>/dev/null || echo missing)"


# -------------------------------------------------
# 3) User in docker-Gruppe
# -------------------------------------------------
if ! groups "$APP_USER" | grep -q docker; then
  log "[3/15] Adding $APP_USER to docker group"
  sudo usermod -aG docker "$APP_USER"
  log "NOTE: Logout/Login required for docker group to apply"
else
  log "[3/15] User already in docker group"
fi

# -------------------------------------------------
# 4) Repo nach /opt spiegeln
# -------------------------------------------------
log "[4/15] Sync repo to $TARGET_DIR"
sudo mkdir -p "$TARGET_DIR"
sudo rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  "$PROJECT_DIR/" "$TARGET_DIR/"

sudo chown -R "$APP_USER:$APP_USER" "$TARGET_DIR"

# -------------------------------------------------
# 5) Submodule
# -------------------------------------------------
log "[5/15] Update git submodules"
cd "$TARGET_DIR"
git submodule sync --recursive
git submodule update --init --recursive

# -------------------------------------------------
# 6) Scripts ausführbar
# -------------------------------------------------
log "[6/15] Make scripts executable"
sudo chmod +x "$TARGET_DIR/scripts/"*.sh || true
sudo chmod +x "$TARGET_DIR/electron-app/start.sh" || true
sudo chmod +x "$TARGET_DIR/scripts/updaterd.py" || true

# -------------------------------------------------
# 7) Host Node deps installieren (für Electron)
# -------------------------------------------------
log "[7/15] Host npm install (for Electron)"
cd "$TARGET_DIR"
sudo -u "$APP_USER" npm install

# -------------------------------------------------
# 8) Fix Electron chrome-sandbox (SUID)
# -------------------------------------------------
log "[8/15] Fix Electron chrome-sandbox permissions"
if [[ -f "$TARGET_DIR/node_modules/electron/dist/chrome-sandbox" ]]; then
  sudo chown root:root "$TARGET_DIR/node_modules/electron/dist/chrome-sandbox"
  sudo chmod 4755 "$TARGET_DIR/node_modules/electron/dist/chrome-sandbox"
else
  log "WARN: chrome-sandbox not found (electron not installed?)"
fi

# -------------------------------------------------
# 9) APP_USER zentral speichern
# -------------------------------------------------
log "[9/15] Write /etc/default/printer-ui"
sudo tee /etc/default/printer-ui >/dev/null <<EOF
APP_USER=$APP_USER
EOF
sudo chmod 0644 /etc/default/printer-ui

# -------------------------------------------------
# 10) systemd System-Units aus Repo installieren
# -------------------------------------------------
log "[10/15] Install systemd system units (backend + update + updater)"

APP_USER_ESCAPED="$(printf '%s\n' "$APP_USER" | sed 's/[\/&]/\\&/g')"

# Backend
sed "s/@APP_USER@/$APP_USER_ESCAPED/g" \
  "$TARGET_DIR/systemd/printer-ui.service.in" \
  | sudo tee /etc/systemd/system/printer-ui.service >/dev/null

# Update
sed "s/@APP_USER@/$APP_USER_ESCAPED/g" \
  "$TARGET_DIR/systemd/printer-ui-update.service.in" \
  | sudo tee /etc/systemd/system/printer-ui-update.service >/dev/null

# Host-Updater (Service-Datei liegt als echte .service im Repo)
sudo cp "$TARGET_DIR/systemd/system/printer-ui-updater.service" \
        /etc/systemd/system/printer-ui-updater.service

# Legacy system electron service deaktivieren (falls vorhanden)
if systemctl list-unit-files | grep -q '^printer-ui-electron\.service'; then
  log "[10/15] Disabling legacy system electron service"
  sudo systemctl disable --now printer-ui-electron.service || true
fi

sudo systemctl daemon-reload
sudo systemctl enable printer-ui.service
sudo systemctl enable printer-ui-update.service
sudo systemctl enable --now printer-ui-updater.service

# -------------------------------------------------
# 11) Electron User-Unit aus Repo installieren + linger
# -------------------------------------------------
log "[11/15] Install user systemd unit for Electron (from repo) + enable linger"

USER_UNIT_DIR="/home/$APP_USER/.config/systemd/user"
sudo mkdir -p "$USER_UNIT_DIR"

sed "s/@APP_USER@/$APP_USER_ESCAPED/g" \
  "$TARGET_DIR/systemd/user/printer-ui-electron.service.in" \
  | sudo tee "$USER_UNIT_DIR/printer-ui-electron.service" >/dev/null

sudo chown -R "$APP_USER:$APP_USER" "/home/$APP_USER/.config"

sudo loginctl enable-linger "$APP_USER"

# Nur versuchen, wenn User-Bus erreichbar
APP_UID="$(id -u "$APP_USER" 2>/dev/null || echo "")"
if [[ -n "${APP_UID:-}" && -S "/run/user/$APP_UID/bus" ]]; then
  log "[11/15] User bus available → enable/start user electron service"
  if command -v machinectl >/dev/null 2>&1; then
    sudo machinectl shell "$APP_USER"@ /bin/bash -lc \
      'systemctl --user daemon-reload && systemctl --user enable --now printer-ui-electron.service' \
      || true
  else
    sudo -u "$APP_USER" XDG_RUNTIME_DIR="/run/user/$APP_UID" systemctl --user daemon-reload || true
    sudo -u "$APP_USER" XDG_RUNTIME_DIR="/run/user/$APP_UID" systemctl --user enable --now printer-ui-electron.service || true
  fi
else
  log "[11/15] User bus not available now → will start on next GUI session"
fi

# -------------------------------------------------
# 12) Docker build + up
# -------------------------------------------------
log "[12/15] docker compose build"
cd "$TARGET_DIR"
docker compose build

log "[12/15] docker compose up -d"
docker compose up -d --remove-orphans

# -------------------------------------------------
# 13) Backend systemd Service starten
# -------------------------------------------------
log "[13/15] Restart backend service"
sudo systemctl restart printer-ui.service || true

# -------------------------------------------------
# 14) Status (system)
# -------------------------------------------------
log "[14/15] Status (system services)"
systemctl --no-pager status printer-ui.service || true
systemctl --no-pager status printer-ui-updater.service || true

# -------------------------------------------------
# 15) Done
# -------------------------------------------------
log "[15/15] INSTALL DONE"
log "If Docker was newly installed: log out and log back in once."
