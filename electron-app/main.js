const { app, BrowserWindow } = require("electron");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: true,      // startet direkt fullscreen
    //kiosk: true,           // echter Kiosk-Modus (kein Alt+Tab etc.)
    autoHideMenuBar: true, // kein Menü
    frame: false,          // kein Fensterrahmen
    cursor: 'none',
    alwaysOnTop: true,     // bleibt oben
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL("http://localhost:3000");

  // Falls der Fokus manchmal fehlt:
  win.once("ready-to-show", () => {
    win.show();
    win.focus();
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  app.quit();
});
