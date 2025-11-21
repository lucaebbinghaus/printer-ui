@echo off
cd /d C:\projects\printer-ui

echo === Start Docker Container ===
docker compose up -d

echo === Wait for server (3 seconds) ===
timeout /t 3 /nobreak > nul

echo === Start Electron UI ===
cd /d C:\projects\printer-ui\electron-app
"C:\Program Files\nodejs\npm.cmd" start