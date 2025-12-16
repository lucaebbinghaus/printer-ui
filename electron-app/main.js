// main.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { exec } = require("child_process");

let mainWindow;
let oskVisible = false;
let oskMode = null; // "numeric" | "text"

function startOnboard(mode) {
  // gleiches Layout nicht neu starten
  if (oskVisible && oskMode === mode) return;

  oskVisible = true;
  oskMode = mode;

  // vorheriges Onboard sicher beenden
  exec("pkill -x onboard >/dev/null 2>&1 || true");

  const layout =
    mode === "numeric"
      ? "NumberPad"
      : "Full Keyboard"; // QWERTZ

  // --dock bottom = unten andocken
  const cmd = `onboard \
    --layout "${layout}" \
    --dock bottom \
    --xid \
    >/dev/null 2>&1 &`;

  exec(cmd);
}

function stopOnboard() {
  if (!oskVisible) return;
  oskVisible = false;
  oskMode = null;
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

/* ===== IPC ===== */

ipcMain.handle("osk:show", (_, mode) => {
  startOnboard(mode); // "numeric" | "text"
});

ipcMain.handle("osk:hide", () => {
  stopOnboard();
});

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
  return mainWindow?.isFullScreen() ?? false;
});

ipcMain.handle("host:shutdown", () => {
  exec("shutdown -h now");
});

app.on("window-all-closed", () => {
  stopOnboard();
  app.quit();
});
