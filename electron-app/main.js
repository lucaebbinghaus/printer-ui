const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { exec } = require("child_process");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: true,
    kiosk: true,
    autoHideMenuBar: true,
    frame: false,
    alwaysOnTop: true,
    cursor: "none",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL("http://localhost:3000");
}

app.whenReady().then(createWindow);

/* ================= IPC ================= */

// Toggle Fullscreen
ipcMain.handle("window:toggle-fullscreen", () => {
  if (!mainWindow) return;
  const isFs = mainWindow.isFullScreen();
  mainWindow.setFullScreen(!isFs);
});

// Fullscreen State abfragen
ipcMain.handle("window:is-fullscreen", () => {
  if (!mainWindow) return false;
  return mainWindow.isFullScreen();
});

// Host herunterfahren (Ubuntu)
ipcMain.handle("host:shutdown", () => {
  exec("shutdown -h now");
});

app.on("window-all-closed", () => {
  app.quit();
});
