const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  toggleFullscreen: () => ipcRenderer.invoke("window:toggle-fullscreen"),
  getFullscreenState: () => ipcRenderer.invoke("window:is-fullscreen"),
  shutdownHost: () => ipcRenderer.invoke("host:shutdown"),
});
