"use strict";
const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
let mainWindow = null;
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: "SPT Mod Config Editor",
    icon: path.join(__dirname, "../public/favicon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    backgroundColor: "#1a1a1a",
    show: false
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });
  Menu.setApplicationMenu(null);
  mainWindow.once("ready-to-show", () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || "http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};
app.whenReady().then(() => {
  createWindow();
  ipcMain.handle("fs:readCategoryFile", async (_event) => {
    try {
      const docsPath = app.getPath("documents");
      const categoryPath = path.join(docsPath, "SPTModConfigEditor", "UserData", "categories.json");
      if (!fsSync.existsSync(categoryPath)) {
        return null;
      }
      const content = await fs.readFile(categoryPath, "utf-8");
      return content;
    } catch (error) {
      console.error("Failed to read category file:", error);
      return null;
    }
  });
  ipcMain.handle("fs:writeCategoryFile", async (_event, content) => {
    try {
      const docsPath = app.getPath("documents");
      const userDataDir = path.join(docsPath, "SPTModConfigEditor", "UserData");
      const categoryPath = path.join(userDataDir, "categories.json");
      await fs.mkdir(userDataDir, { recursive: true });
      await fs.writeFile(categoryPath, content, "utf-8");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to write category file: ${message}`);
    }
  });
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
ipcMain.handle("dialog:selectFolder", async (_event) => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
    title: "Select SPT Installation Folder"
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }
  return { canceled: false, path: result.filePaths[0] };
});
ipcMain.handle("fs:readdir", async (_event, dirPath) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries.map((e) => ({
    name: e.name,
    isFile: e.isFile(),
    isDirectory: e.isDirectory()
  }));
});
ipcMain.handle("fs:readFile", async (_event, filePath) => {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return data;
  } catch (err) {
    console.error("Failed to read file:", err);
    throw err;
  }
});
ipcMain.handle("fs:writeFile", async (_event, filePath, content) => {
  await fs.writeFile(filePath, content, "utf-8");
  return true;
});
ipcMain.handle("fs:exists", async (_event, filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});
ipcMain.handle("fs:stat", async (_event, targetPath) => {
  try {
    const stats = await fs.stat(targetPath);
    return {
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      size: stats.size
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to get stats: ${message}`);
  }
});
ipcMain.handle("app:getDocumentsPath", async (_event) => {
  return app.getPath("documents");
});
ipcMain.handle("fs:writeHistoryBackup", async (_event, modName, configFile, timestamp, content) => {
  try {
    const docsPath = app.getPath("documents");
    const backupDir = path.join(docsPath, "SPTModConfigEditor", "History Backups", modName);
    await fs.mkdir(backupDir, { recursive: true });
    const filename = `${configFile.replace(/\.[^/.]+$/, "")}_${timestamp}.json`;
    const backupPath = path.join(backupDir, filename);
    await fs.writeFile(backupPath, content, "utf-8");
    return { success: true, path: backupPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to write history backup: ${message}`);
  }
});
ipcMain.handle("fs:readHistoryBackups", async (_event, modName, configFile) => {
  try {
    const docsPath = app.getPath("documents");
    const backupDir = path.join(docsPath, "SPTModConfigEditor", "History Backups", modName);
    if (!fsSync.existsSync(backupDir)) {
      return [];
    }
    const configPrefix = configFile.replace(/\.[^/.]+$/, "");
    const entries = await fs.readdir(backupDir, { withFileTypes: true });
    const backups = [];
    for (const entry of entries) {
      if (entry.isFile() && entry.name.startsWith(configPrefix) && entry.name.endsWith(".json")) {
        const filePath = path.join(backupDir, entry.name);
        const content = await fs.readFile(filePath, "utf-8");
        const stats = await fs.stat(filePath);
        const match = entry.name.match(/_(\d+)\.json$/);
        const timestamp = match ? parseInt(match[1]) : stats.mtimeMs;
        backups.push({
          filename: entry.name,
          timestamp,
          content: JSON.parse(content),
          size: stats.size
        });
      }
    }
    return backups.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to read history backups: ${message}`);
  }
});
ipcMain.handle("fs:deleteHistoryBackup", async (_event, modName, filename) => {
  try {
    const docsPath = app.getPath("documents");
    const backupPath = path.join(docsPath, "SPTModConfigEditor", "History Backups", modName, filename);
    await fs.unlink(backupPath);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to delete history backup: ${message}`);
  }
});
ipcMain.handle("fs:clearHistoryBackups", async (_event, modName, configFile) => {
  try {
    const docsPath = app.getPath("documents");
    const backupDir = path.join(docsPath, "SPTModConfigEditor", "History Backups", modName);
    const configPrefix = configFile.replace(/\.[^/.]+$/, "");
    const entries = await fs.readdir(backupDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.startsWith(configPrefix)) {
        await fs.unlink(path.join(backupDir, entry.name));
      }
    }
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to clear history backups: ${message}`);
  }
});
