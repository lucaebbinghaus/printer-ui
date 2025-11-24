#!/bin/bash
set -e

echo "=== Printer UI Setup Script (Docker backend + Electron host, Bookworm) ==="

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
# 4) Docker + Compose aus OFFIZIELLEM Docker-Repo installieren
# -------------------------------
echo "[4/9] Installing Docker + compose plugin (from official Docker repo)..."

sudo apt install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/debian bookworm stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update

sudo apt install -y \
  docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker pi
# -------------------------------
# 5) Node.js + npm installieren (Node 20 LTS)
# -------------------------------
echo "[5/10] Installing Node.js 20 LTS..."

sudo apt update
sudo apt install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
  | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
sudo chmod a+r /etc/apt/keyrings/nodesource.gpg

echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] \
https://deb.nodesource.com/node_20.x nodistro main" \
| sudo tee /etc/apt/sources.list.d/nodesource.list

sudo apt update
sudo apt install -y nodejs

node -v
npm -v

# -------------------------------
# 5) Node/Electron Dependencies installieren (Electron läuft auf Host)
# -------------------------------
echo "[5/9] Installing Node dependencies for Electron..."
cd "$PROJECT_DIR"

npm install
npm install electron --save-dev

# -------------------------------
# 6) Docker Images/Services bauen (compose wird vorausgesetzt)
# -------------------------------
echo "[6/9] Building Docker services..."

if [ ! -f docker-compose.yml ] && [ ! -f docker-compose.yaml ]; then
  echo "ERROR: No docker-compose.yml found in $PROJECT_DIR"
  exit 1
fi

docker compose build

# -------------------------------
# 7) systemd Service für Docker-Backend (detach/oneshot)
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
# 8) systemd Service für Electron-Kiosk (Host mit X11)
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
# 9) Desktop-Autologin sicherstellen
# -------------------------------
echo "[9/9] Enabling desktop autologin..."
sudo raspi-config nonint do_boot_behaviour B4

echo "Starting services..."
sudo systemctl start printer-ui.service
sudo systemctl start printer-ui-electron.service

echo "=== Setup complete. REBOOT HIGHLY RECOMMENDED. ==="
echo "NOTE: Docker group membership for 'pi' activates after reboot."
