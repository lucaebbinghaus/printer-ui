#!/bin/bash
set -e

echo "=== Printer UI Setup Script ==="

# -------------------------------
# 1) System aktualisieren
# -------------------------------
echo "[1/8] Updating system..."
sudo apt update -y
sudo apt upgrade -y

# -------------------------------
# 2) On-Screen Keyboard installieren
# -------------------------------
echo "[2/8] Installing Onboard (On-Screen-Keyboard)..."
sudo apt install -y onboard

mkdir -p ~/.config/lxsession/LXDE-pi
AUTOSTART=~/.config/lxsession/LXDE-pi/autostart

if ! grep -q "onboard" "$AUTOSTART"; then
  echo "@onboard" >> "$AUTOSTART"
fi

# -------------------------------
# 3) Node, npm & electron deps installieren
# -------------------------------
echo "[3/8] Installing Node dependencies..."
cd "$(dirname "$0")"

npm install
npm install electron --save-dev

# -------------------------------
# 4) Next.js builden
# -------------------------------
echo "[4/8] Building Next.js application..."
npm run build

# -------------------------------
# 5) systemd Services installieren
# -------------------------------
echo "[5/8] Installing systemd services..."

sudo tee /etc/systemd/system/printer-ui.service > /dev/null <<EOF
[Unit]
Description=Printer UI Next.js Backend
After=network.target

[Service]
WorkingDirectory=$HOME/printer-ui
ExecStart=/usr/bin/npm start
Restart=always
User=pi
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/printer-ui-electron.service > /dev/null <<EOF
[Unit]
Description=Printer UI Electron Kiosk
After=graphical.target printer-ui.service
Wants=graphical.tar
