const { app, BrowserWindow } = require("electron");
const http = require("http");

function waitForServer(url, timeout = 30000) {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      http
        .get(url, (res) => {
          // Server antwortet -> bereit
          resolve();
        })
        .on("error", () => {
          if (Date.now() - startTime > timeout) {
            reject(new Error("Server not reachable within timeout"));
          } else {
            setTimeout(check, 500);
          }
        });
    };

    check();
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: true,
    kiosk: true,
    autoHideMenuBar: true,
    frame: false,
    alwaysOnTop: true,
    cursor: "none",
    show: false, // wichtig: erst anzeigen, wenn geladen
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  try {
    console.log("Waiting for server...");
    await waitForServer("http://localhost:3000");
    console.log("Server reachable, loading UI");

    await win.loadURL("http://localhost:3000");
  } catch (err) {
    console.error(err);

    // Fallback: einfacher Fehlerbildschirm
    win.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent("<h1>Server nicht erreichbar</h1>")
    );
  }

  win.webContents.on("did-finish-load", () => {
    win.webContents.setZoomFactor(1.5);
  });

  win.once("ready-to-show", () => {
    win.show();
    win.focus();
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  app.quit();
});
