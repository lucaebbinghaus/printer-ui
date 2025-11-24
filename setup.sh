#!/bin/bash
set -e

echo "=== Printer UI Setup Script (Docker backend + Electron host) ==="

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
AUTOSTART="$HOME/.config/lxsession/LXDE-pi/autostart"

# -------------------------------
# 1) System aktualisieren
# -------------------------------
echo "[1/9] Updating system..."
sudo apt update -y
sudo apt upgrade -y

# -------------------------------
# 2) On-Screen Keyboard installieren (Onboard)
# -------------------------------
echo "[2/9] Installing Onboard (On-Screen-Keyboard)..."
sudo apt install -y onboard

mkdir -p "$(dirname "$AUTOSTART")"
touch "$AUTOSTART"

if ! grep -q "onboard" "$AUTOSTART" 2>/dev/null; then
  echo "@onboard" >> "$AUTOSTART"
fi

# -------------------------------
# 3) Cursor ausblenden (unclutter)
# -------------------------------
echo "[3/9] Installing unclutter..."
sudo apt install -y unclutter

if ! grep -q "unclutter" "$AUTOSTART" 2>/dev/null; then
  echo "@unclutter -idle 0 -root" >> "$AUTOSTART"
fi

# -------------------------------
# 4) Docker installieren + für pi freigeben
# -------------------------------
echo "[4/9] Installing Docker + compose plugin..."
sudo apt install -y docker.io docker-compose-plugin

sudo systemctl enable docker
sudo systemctl start docker

# pi zur docker Gruppe hinzufügen (Greift nach Logout/Login oder Reboot)
sudo usermod -aG docker pi

# -------------------------------
# 5) Repo Dependencies nur für Electron installieren
#    (Electron läuft auf Host)
# -------------------------------
echo "[5/9] Installing Node dependencies for Electron..."
cd "$PROJECT_DIR"

npm install
npm install electron --save-dev

# -------------------------------
# 6) Docker Images/Services bauen
#    (compose wird vorausgesetzt)
# -------------------------------
echo "[6/9] Building Docker services..."
if [ ! -f docker-compose.yml ] && [ ! -f docker-compose.yaml ]; then
  echo "ERROR: No docker-compose.yml found in $PROJECT_DIR"
  echo "Please add docker-compose.yml (recommended) or tell me to adapt this script for single Dockerfile."
  exit 1
fi

docker compose build

# -------------------------------
# 7) systemd Service für Docker-Backend
#    robust als detach/oneshot Service
# -------------------------------
echo "[7/9] Installing systemd service for Docker backend..."

sudo tee /etc/systemd/system/printer-ui.service > /dev/null <<EOF
[Unit]
Description=Printer UI Backend (Docker)
After=docker.service network.target
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=$PROJECT_DIR
ExecStart=/usr/bin/docker compose up -d --remove-orphans
ExecStop=/usr/bin/docker compose down
RemainAfterExit=yes
User=pi

[Install]
WantedBy=multi-user.target
EOF

# -------------------------------
# 8) systemd Service für Electron-Kiosk (Host)
#    extra robust gegen X11-Start-Rennen
# -------------------------------
echo "[8/9] Installing systemd service for Electron kiosk..."

sudo tee /etc/systemd/system/printer-ui-electron.service > /dev/null <<EOF
[Unit]
Description=Printer UI Electron Kiosk
After=graphical.target display-manager.service printer-ui.service
Wants=graphical.target

[Service]
Type=simple
WorkingDirectory=$PROJECT_DIR
ExecStartPre=/bin/sleep 2
ExecStart=/usr/bin/npm run electron
User=pi
Restart=always
RestartSec=2
Environment=DISPLAY=:0
Environment=XAUTHORITY=/home/pi/.Xauthority

[Install]
WantedBy=graphical.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable printer-ui.service
sudo systemctl enable printer-ui-electron.service

# -------------------------------
# 9) Desktop Autologin sicherstellen
# -------------------------------
echo "[9/9] Ensuring desktop autologin..."
sudo raspi-config nonint do_boot_behaviour B4

echo "Starting services..."
sudo systemctl start printer-ui.service
sudo systemctl start printer-ui-electron.service

echo "=== Setup complete. Reboot recommended. ==="
echo "NOTE: Docker group change may require logout/login or reboot to take effect."
