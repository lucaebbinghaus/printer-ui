const { app, BrowserWindow } = require("electron");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: false,
    kiosk: false, // → true = Touchscreen-Kiosk-Modus
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
    }
  });

  // WICHTIG: Deine LAN- oder lokale docker-compose-Adresse
  win.loadURL("http://localhost:3000");

  // Optional: Devtools deaktivieren
  // win.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Unter Windows App vollständig schließen
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
