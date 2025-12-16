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

# -------------------------------
# 1) Docker installieren (falls fehlt)
# -------------------------------
if ! has_cmd docker; then
  log "[1/12] Docker not found → installing"
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

# -------------------------------
# 2) Node.js 20 installieren / upgraden (Next 16 braucht >= 20.9)
# -------------------------------
if ! has_cmd node; then
  log "[2/12] Installing Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
else
  NODE_MAJOR="$(node -v | sed 's/v//' | cut -d. -f1 || echo 0)"
  if [[ "${NODE_MAJOR:-0}" -lt 20 ]]; then
    log "[2/12] Node too old ($(node -v)) → upgrading to 20.x"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
  else
    log "[2/12] Node OK: $(node -v)"
  fi
fi

# -------------------------------
# 3) User in docker group
# -------------------------------
if ! groups "$APP_USER" | grep -q docker; then
  log "[3/12] Adding $APP_USER to docker group"
  sudo usermod -aG docker "$APP_USER"
  log "NOTE: Logout/Login required for docker group to apply"
else
  log "[3/12] User already in docker group"
fi

# -------------------------------
# 4) Repo nach /opt spiegeln
# -------------------------------
log "[4/12] Sync repo to $TARGET_DIR"
sudo mkdir -p "$TARGET_DIR"
sudo rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  "$PROJECT_DIR/" "$TARGET_DIR/"

# Ownership muss sauber sein (verhindert git "dubious ownership")
sudo chown -R "$APP_USER:$APP_USER" "$TARGET_DIR"

# -------------------------------
# 5) Submodules
# -------------------------------
log "[5/12] Submodules"
cd "$TARGET_DIR"
git submodule sync --recursive
git submodule update --init --recursive

# -------------------------------
# 6) Permissions
# -------------------------------
log "[6/12] Permissions"
sudo chmod +x "$TARGET_DIR/scripts/"*.sh || true
sudo chmod +x "$TARGET_DIR/electron-app/start.sh" || true

# -------------------------------
# 7) Host npm install (Electron runtime)
# -------------------------------
log "[7/12] npm install"
cd "$TARGET_DIR"
sudo -u "$APP_USER" npm install

# chrome-sandbox SUID (optional)
if [[ -f "$TARGET_DIR/node_modules/electron/dist/chrome-sandbox" ]]; then
  sudo chown root:root "$TARGET_DIR/node_modules/electron/dist/chrome-sandbox"
  sudo chmod 4755 "$TARGET_DIR/node_modules/electron/dist/chrome-sandbox"
fi

# -------------------------------
# 8) /etc/default/printer-ui
# -------------------------------
log "[8/12] Write /etc/default/printer-ui"
sudo tee /etc/default/printer-ui >/dev/null <<EOF
APP_USER=$APP_USER
EOF
sudo chmod 0644 /etc/default/printer-ui

APP_USER_ESCAPED="$(printf '%s\n' "$APP_USER" | sed 's/[\/&]/\\&/g')"

# Fallback: mark repo safe for git (covers cases where root executes git)
sudo git config --global --add safe.directory "$TARGET_DIR" || true

# -------------------------------
# 9) Legacy cleanup (wichtig)
# -------------------------------
log "[9/12] Cleanup legacy units"

# alte/legacy Services
sudo systemctl disable --now printer-ui-updater.service 2>/dev/null || true
sudo systemctl disable --now printer-ui-update.service  2>/dev/null || true
sudo systemctl disable --now printer-ui-api.service     2>/dev/null || true

sudo rm -f /etc/systemd/system/printer-ui-updater.service
sudo rm -f /etc/systemd/system/printer-ui-update.service
sudo rm -f /etc/systemd/system/printer-ui-api.service

# GANZ wichtig: Electron darf NICHT als system unit existieren
sudo systemctl disable --now printer-ui-electron.service 2>/dev/null || true
sudo rm -f /etc/systemd/system/printer-ui-electron.service

# -------------------------------
# 10) Install systemd SYSTEM units (backend + update-api)
# -------------------------------
log "[10/12] Install systemd system units"

# Backend (Docker)
if [[ ! -f "$TARGET_DIR/systemd/system/printer-ui.service.in" ]]; then
  log "ERROR: Missing $TARGET_DIR/systemd/system/printer-ui.service.in"
  exit 1
fi

sed "s/@APP_USER@/$APP_USER_ESCAPED/g" \
  "$TARGET_DIR/systemd/system/printer-ui.service.in" \
  | sudo tee /etc/systemd/system/printer-ui.service >/dev/null

# Host Update API
if [[ ! -f "$TARGET_DIR/systemd/system/printer-ui-update-api.service" ]]; then
  log "ERROR: Missing $TARGET_DIR/systemd/system/printer-ui-update-api.service"
  exit 1
fi

sudo cp "$TARGET_DIR/systemd/system/printer-ui-update-api.service" \
        /etc/systemd/system/printer-ui-update-api.service

# Ensure update-api runs as APP_USER (so git access matches repo ownership)
if ! sudo grep -q '^User=' /etc/systemd/system/printer-ui-update-api.service; then
  sudo perl -0777 -i -pe "s/\[Service\]\n/\[Service\]\nUser=$APP_USER\n/" \
    /etc/systemd/system/printer-ui-update-api.service
else
  sudo sed -i "s/^User=.*/User=$APP_USER/" /etc/systemd/system/printer-ui-update-api.service
fi

sudo systemctl daemon-reload
sudo systemctl enable --now printer-ui.service
sudo systemctl enable --now printer-ui-update-api.service
sudo systemctl restart printer-ui-update-api.service

# -------------------------------
# 11) Install systemd USER unit (Electron) + linger
# -------------------------------
log "[11/12] Install electron user unit + enable linger"

if [[ ! -f "$TARGET_DIR/systemd/user/printer-ui-electron.service.in" ]]; then
  log "ERROR: Missing $TARGET_DIR/systemd/user/printer-ui-electron.service.in"
  exit 1
fi

USER_UNIT_DIR="/home/$APP_USER/.config/systemd/user"
sudo mkdir -p "$USER_UNIT_DIR"

sed "s/@APP_USER@/$APP_USER_ESCAPED/g" \
  "$TARGET_DIR/systemd/user/printer-ui-electron.service.in" \
  | sudo tee "$USER_UNIT_DIR/printer-ui-electron.service" >/dev/null

sudo chown -R "$APP_USER:$APP_USER" "/home/$APP_USER/.config"

sudo loginctl enable-linger "$APP_USER"

# Nur starten, wenn User-Session/Bus existiert (sonst startet es beim nächsten Login)
APP_UID="$(id -u "$APP_USER" 2>/dev/null || echo "")"
if [[ -n "${APP_UID:-}" && -S "/run/user/$APP_UID/bus" ]]; then
  log "[11/12] User bus available → enable/start electron user service"
  sudo -u "$APP_USER" XDG_RUNTIME_DIR="/run/user/$APP_UID" systemctl --user daemon-reload || true
  sudo -u "$APP_USER" XDG_RUNTIME_DIR="/run/user/$APP_UID" systemctl --user enable --now printer-ui-electron.service || true
else
  log "[11/12] No user session yet → electron will start on first GUI login"
fi

# -------------------------------
# 12) Docker up (ensure containers running)
# -------------------------------
log "[12/12] docker compose up -d"
cd "$TARGET_DIR"
docker compose up -d --remove-orphans

log "=== INSTALL DONE ==="
log "Tip: Check services:"
log "  systemctl status printer-ui.service printer-ui-update-api.service --no-pager"
log "  curl -sS http://127.0.0.1:9876/update/check && echo"
log "  journalctl --user -u printer-ui-electron.service -n 50 --no-pager"
