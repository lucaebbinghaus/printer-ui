#!/usr/bin/env bash
set -e

export DISPLAY=${DISPLAY:-:0}
export KIOSK_URL=${KIOSK_URL:-http://localhost:3000}

cd /opt/printer-ui/electron-app
exec npm run kiosk
