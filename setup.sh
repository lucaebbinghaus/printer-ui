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
Wants=graphical.target

[Service]
WorkingDirectory=$HOME/printer-ui
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
# 6) LXDE Autostart sicherstellen
# -------------------------------
echo "[6/8] Ensuring desktop autologin & X11..."
sudo raspi-config nonint do_boot_behaviour B4

# -------------------------------
# 7) Electron icons + cursor fix optional
# -------------------------------
echo "[7/8] Creating cursor-fix for full kiosk..."
sudo apt install -y unclutter
if ! grep -q "unclutter" "$AUTOSTART"; then
  echo "@unclutter" >> "$AUTOSTART"
fi


echo "[X] Installing unclutter for cursor hiding..."
sudo apt install -y unclutter

# Autostart einrichten (falls nicht vorhanden)
mkdir -p /home/pi/.config/lxsession/LXDE-pi
AUTOSTART="/home/pi/.config/lxsession/LXDE-pi/autostart"

# Eintrag nur einmal hinzufügen
if ! grep -q "unclutter" "$AUTOSTART"; then
    echo "@unclutter -idle 0 -root" >> "$AUTOSTART"
fi

echo "Unclutter installed and autostart configured."


# -------------------------------
# 8) Alles starten
# -------------------------------
echo "[8/8] Starting services..."
sudo systemctl start printer-ui.service
sudo systemctl start printer-ui-electron.service

echo "=== Setup complete. Reboot recommended. ==="
