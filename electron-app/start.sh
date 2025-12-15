#!/usr/bin/env bash
set -e

export DISPLAY=${DISPLAY:-:0}
export KIOSK_URL=${KIOSK_URL:-http://localhost:3000}

# Warten bis HTTP erreichbar ist (max 60s)
for i in {1..60}; do
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS "$KIOSK_URL" >/dev/null 2>&1; then
      break
    fi
  else
    # fallback: kein curl installiert -> nicht blockieren
    break
  fi
  sleep 1
done

cd /opt/printer-ui/electron-app
exec npm run kiosk
