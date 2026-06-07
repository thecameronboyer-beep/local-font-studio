const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");

const appId = "com.thecameronboyer.quill";
const devUrl = process.env.QUILL_ELECTRON_RENDERER_URL;
const isSmokeRun = process.env.QUILL_ELECTRON_SMOKE === "1";

if (process.env.QUILL_ELECTRON_DISABLE_GPU === "1") {
  app.disableHardwareAcceleration();
}

app.setName("Quill");

if (process.platform === "win32") {
  app.setAppUserModelId(appId);
}

let mainWindow = null;

function isAllowedNavigation(url) {
  if (devUrl && url.startsWith(devUrl)) {
    return true;
  }

  if (!devUrl && url.startsWith("file://")) {
    return true;
  }

  return false;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 420,
    minHeight: 680,
    backgroundColor: "#dbe3f1",
    title: "Quill",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAllowedNavigation(url)) {
      return;
    }

    event.preventDefault();
    shell.openExternal(url);
  });

  mainWindow.webContents.on("did-fail-load", (_event, _errorCode, errorDescription) => {
    if (isSmokeRun) {
      console.error(`Quill Electron smoke failed: ${errorDescription}`);
      process.exitCode = 1;
      app.quit();
    }
  });

  if (isSmokeRun) {
    mainWindow.webContents.once("did-finish-load", () => {
      setTimeout(() => app.quit(), 500);
    });
  }

  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

ipcMain.handle("quill:get-app-info", () => ({
  name: "Quill",
  version: app.getVersion(),
  platform: process.platform,
  isPackaged: app.isPackaged,
}));

app.whenReady().then(createWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
