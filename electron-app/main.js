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

/* ===== Resize statt Minimize ===== */

ipcMain.handle("window:toggle-resize", () => {
  if (!mainWindow) return;

  const isFs = mainWindow.isFullScreen();

  if (isFs) {
    mainWindow.setKiosk(false);
    mainWindow.setFullScreen(false);
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setBounds({ width: 1280, height: 800 });
    mainWindow.center();
  } else {
    mainWindow.setFullScreen(true);
    mainWindow.setKiosk(true);
  }
});

ipcMain.handle("window:is-fullscreen", () => {
  if (!mainWindow) return false;
  return mainWindow.isFullScreen();
});

ipcMain.handle("host:shutdown", () => {
  exec("shutdown -h now");
});

app.on("window-all-closed", () => {
  // beim Beenden sicherheitshalber OSK aus
  app.quit();
});
