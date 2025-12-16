// main.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { exec } = require("child_process");

let mainWindow;

let oskVisible = false;
let oskMode = null; // "numeric" | "text"

function run(cmd) {
  // Wichtig: NICHT alles nach /dev/null, sonst siehst du keine Fehler
  exec(cmd, { env: { ...process.env, DISPLAY: process.env.DISPLAY || ":0" } }, (err, stdout, stderr) => {
    if (err) {
      console.error("[OSK exec error]", err.message);
    }
    if (stdout) console.log("[OSK stdout]", stdout.trim());
    if (stderr) console.error("[OSK stderr]", stderr.trim());
  });
}

function getXauthority() {
  // Falls Electron als derselbe Desktop-User läuft, reicht meistens das.
  // Wenn dein Service als anderer User läuft, musst du den Pfad anpassen.
  const home = process.env.HOME || "/home/printer1";
  return process.env.XAUTHORITY || path.join(home, ".Xauthority");
}

function startOnboard(mode) {
  if (oskVisible && oskMode === mode) return;

  oskVisible = true;
  oskMode = mode;

  // vorheriges Onboard beenden
  run("pkill -x onboard || true");

  // X11-Env sicher setzen (häufigster Grund für “geht nicht auf”)
  const DISPLAY = process.env.DISPLAY || ":0";
  const XAUTHORITY = getXauthority();

  // Layout: Onboard-Layoutnamen sind je nach System unterschiedlich.
  // Daher: erst “plain” starten, dann optional Layout via gsettings/Profil.
  // Dock: Onboard unterstützt Docking in der UI; CLI-Flags sind je nach Version unterschiedlich.
  // -> Wir starten robust ohne fragile Flags.
  const cmd = `DISPLAY=${DISPLAY} XAUTHORITY=${XAUTHORITY} onboard --xid &`;

  console.log("[OSK] start:", { mode, DISPLAY, XAUTHORITY });
  run(cmd);
}

function stopOnboard() {
  if (!oskVisible) return;
  oskVisible = false;
  oskMode = null;
  console.log("[OSK] stop");
  run("pkill -x onboard || true");
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

  mainWindow.webContents.on("did-finish-load", () => {
    console.log("[Electron] did-finish-load");
  });
}

app.whenReady().then(createWindow);

/* ===== IPC ===== */
ipcMain.handle("osk:show", (_, mode) => {
  const m = mode === "numeric" ? "numeric" : "text";
  startOnboard(m);
});

ipcMain.handle("osk:hide", () => {
  stopOnboard();
});

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
  return mainWindow?.isFullScreen() ?? false;
});

ipcMain.handle("host:shutdown", () => {
  run("shutdown -h now");
});

app.on("window-all-closed", () => {
  stopOnboard();
  app.quit();
});
