const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  toggleResize: () => ipcRenderer.invoke("window:toggle-resize"),
  getFullscreenState: () => ipcRenderer.invoke("window:is-fullscreen"),
  shutdownHost: () => ipcRenderer.invoke("host:shutdown"),
});
