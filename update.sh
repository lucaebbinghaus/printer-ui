#!/bin/bash
set -e

echo "=== Printer UI Update Script ==="

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# -------------------------------
# 1) Services stoppen (in richtiger Reihenfolge)
# -------------------------------
echo "[1/6] Stopping services..."
sudo systemctl stop printer-ui-electron.service || true
sudo systemctl stop printer-ui.service || true

# -------------------------------
# 2) Lokale Änderungen verwerfen (damit Pull sauber ist)
#    Wenn du lokale Config behalten willst, sag Bescheid, dann machen wir stash/skip.
# -------------------------------
echo "[2/6] Cleaning working tree..."
git reset --hard
git clean -fd

# -------------------------------
# 3) Repo pullen
# -------------------------------
echo "[3/6] Pulling latest changes..."
git pull

# -------------------------------
# 4) Node deps (für Electron) aktualisieren
# -------------------------------
echo "[4/6] Installing/updating Node dependencies..."
npm install

# Electron sicherstellen (falls neu hinzugekommen)
npm install electron --save-dev

# -------------------------------
# 5) Docker neu bauen
# -------------------------------
echo "[5/6] Rebuilding Docker services..."
docker compose build --no-cache

# -------------------------------
# 6) Services starten
# -------------------------------
echo "[6/6] Starting services..."
sudo systemctl start printer-ui.service
sudo systemctl start printer-ui-electron.service

echo "=== Update complete ==="
