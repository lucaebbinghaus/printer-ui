const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { exec } = require("child_process");

let mainWindow;

// Disable Electron sandbox to prevent sudo password prompts
// This is safe for kiosk/embedded applications
process.env.ELECTRON_DISABLE_SANDBOX = "1";

// Wayland compatibility fixes
if (process.env.XDG_SESSION_TYPE === "wayland") {
  // Disable GPU acceleration on Wayland to prevent crashes
  app.disableHardwareAcceleration();
}

// Prevent Electron from being garbage collected
app.allowRendererProcessReuse = false;



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
      sandbox: false, // Disable sandbox to prevent sudo password prompts
      // Disable background throttling to prevent resource cleanup issues
      backgroundThrottling: false,
    },
  });

  mainWindow.loadURL("http://localhost:3000");

  // Prevent window from being garbage collected
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
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
  if (mainWindow) {
    mainWindow.destroy();
    mainWindow = null;
  }
  app.quit();
});

// Cleanup on app quit
app.on("before-quit", () => {
  if (mainWindow) {
    mainWindow.destroy();
    mainWindow = null;
  }
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // Don't crash the app, just log it
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Don't crash the app, just log it
});
