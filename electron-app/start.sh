#!/usr/bin/env bash
set -e

export DISPLAY=${DISPLAY:-:0}
export KIOSK_URL=${KIOSK_URL:-http://localhost:3000}

# warten bis Backend erreichbar (max 60s)
for i in {1..60}; do
  if command -v curl >/dev/null 2>&1 && curl -fsS "$KIOSK_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

cd /opt/printer-ui

# nutzt dein vorhandenes Script: "electron": "electron electron-app/main.js"
exec npm run electron
