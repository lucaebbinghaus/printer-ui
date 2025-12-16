// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  oskShow: (mode) => ipcRenderer.invoke("osk:show", mode), // "numeric" | "text"
  oskHide: () => ipcRenderer.invoke("osk:hide"),

  toggleResize: () => ipcRenderer.invoke("window:toggle-resize"),
  getFullscreenState: () => ipcRenderer.invoke("window:is-fullscreen"),
  shutdownHost: () => ipcRenderer.invoke("host:shutdown"),
});
