const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { exec } = require("child_process");

let mainWindow;

/* ===== On-Screen Keyboard (Ubuntu) via onboard ===== */
let oskVisible = false;

function oskShow() {
  if (oskVisible) return;
  oskVisible = true;

  // onboard starten (falls schon läuft, ist es unkritisch)
  // --xid: normaler Fenstermodus, gut für Kiosk
  exec("onboard --xid >/dev/null 2>&1 &");
}

function oskHide() {
  if (!oskVisible) return;
  oskVisible = false;

  // onboard beenden
  exec("pkill -x onboard >/dev/null 2>&1 || true");
}

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

/* ===== OSK IPC ===== */
ipcMain.handle("osk:show", () => oskShow());
ipcMain.handle("osk:hide", () => oskHide());

app.on("window-all-closed", () => {
  // beim Beenden sicherheitshalber OSK aus
  oskHide();
  app.quit();
});
