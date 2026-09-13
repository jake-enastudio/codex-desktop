import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMainWindowOptions } from "./windowOptions.js";
import {
  initializeWorth,
  setWorthWindow,
  closeWorth,
} from "./worthRuntime.mjs";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rendererDevUrl = !app.isPackaged
  ? process.env.ELECTRON_RENDERER_URL
  : undefined;
app.setName("Worth");
if (process.env.WORTH_DATA_DIR)
  app.setPath("userData", process.env.WORTH_DATA_DIR);
let initialized = false;
let mainWindow: BrowserWindow | undefined;
async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    ...buildMainWindowOptions(path.join(__dirname, "../preload/index.cjs")),
    title: "Worth",
  });
  mainWindow = window;
  if (!initialized) {
    initializeWorth(window);
    initialized = true;
  } else setWorthWindow(window);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  if (rendererDevUrl) {
    await window.loadURL(rendererDevUrl);
    return;
  }
  await window.loadFile(path.join(__dirname, "../renderer/index.html"));
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app
    .whenReady()
    .then(createWindow)
    .catch((error) => {
      console.error("Failed to open Worth:", error);
      app.quit();
    });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("before-quit", closeWorth);
}
