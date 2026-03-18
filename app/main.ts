import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";

const CORE_URL = process.env.CORE_URL ?? "http://127.0.0.1:4317";

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const htmlPath = path.resolve(process.cwd(), "app", "index.html");
  void win.loadFile(htmlPath);
  return win;
}

app.whenReady().then(() => {
  ipcMain.handle("core:url", () => CORE_URL);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
