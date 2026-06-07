const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("quillDesktop", {
  isDesktop: true,
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  getAppInfo: () => ipcRenderer.invoke("quill:get-app-info"),
});
