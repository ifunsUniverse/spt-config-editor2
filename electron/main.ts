import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { spawn } from 'child_process';
import https from 'https';

// Hardened Production Network Stack Fixes
app.commandLine.appendSwitch("enable-features", "NetworkServiceInProcess");

let mainWindow: BrowserWindow | null = null;

// Module-level cache variables
let itemCache: any | null = null;
let lastFetchTime: number = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000;

// Diagnostic listeners for production shutdown issues
process.on("beforeExit", () => console.log("beforeExit fired"));
process.on("exit", () => console.log("exit fired"));
process.on("uncaughtException", (err) => console.error("Uncaught exception:", err));

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 400,
    minHeight: 500,
    title: "SPT Mod Config Editor",
    webPreferences: {
      // Ensure path points to compiled JS in dist-electron
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    backgroundColor: "#1a1a1a",
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  Menu.setApplicationMenu(null);

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    console.log("Window closed event fired");
    mainWindow = null;
    // Explicitly quit when the main window is closed to prevent lingering processes
    app.quit();
  });
}

function registerIpcHandlers() {
  ipcMain.handle("spt:fetch-items", async () => {
    const cacheFilePath = path.join(app.getPath("userData"), "item-cache.json");
    const now = Date.now();

    if (itemCache && (now - lastFetchTime < CACHE_TTL)) {
      return itemCache;
    }

    if (!itemCache && fsSync.existsSync(cacheFilePath)) {
      try {
        const diskCacheRaw = await fs.readFile(cacheFilePath, "utf-8");
        const diskCache = JSON.parse(diskCacheRaw);
        if (now - diskCache.timestamp < CACHE_TTL) {
          itemCache = diskCache.data;
          lastFetchTime = diskCache.timestamp;
          return itemCache;
        }
      } catch (err) {
        console.error("[ItemDB] Cache load fail", err);
      }
    }

    return new Promise((resolve, reject) => {
      const query = JSON.stringify({
        query: `{ items(lang: en) { id name shortName types } }`
      });

      const options = {
        hostname: "api.tarkov.dev",
        path: "/graphql",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SPT-Mod-Config-Editor/1.0.3",
          "Content-Length": Buffer.byteLength(query)
        },
        timeout: 15000
      };

      const req = https.request(options, (res) => {
        let body = "";
        res.setEncoding("utf-8");
        res.on("data", (chunk) => body += chunk);
        res.on("end", () => {
          try {
            if (res.statusCode && res.statusCode >= 400) throw new Error(`HTTP ${res.statusCode}`);
            const result = JSON.parse(body);
            itemCache = result;
            lastFetchTime = Date.now();
            fs.writeFile(cacheFilePath, JSON.stringify({ timestamp: lastFetchTime, data: result }), "utf-8").catch(() => {});
            resolve(result);
          } catch (e) {
            if (itemCache) resolve(itemCache);
            else reject(e);
          }
        });
      });

      req.on("error", (err) => {
        if (itemCache) resolve(itemCache);
        else reject(err);
      });

      req.write(query);
      req.end();
    });
  });

  ipcMain.handle("spt:launch", async (_event, { exePath }) => {
    if (!fsSync.existsSync(exePath)) throw new Error(`Not found: ${exePath}`);
    const executable = path.basename(exePath);
    const sptPath = path.dirname(exePath);
    try {
      const isServer = executable.toLowerCase().includes('server');
      if (isServer) {
        spawn('cmd.exe', ['/c', 'start', '"SPT Server"', executable], {
          cwd: sptPath, 
          shell: true, 
          detached: true, 
          stdio: 'ignore'
        }).unref();
      } else {
        spawn(exePath, [], { 
          cwd: sptPath, 
          detached: true, 
          shell: false, 
          stdio: 'ignore' 
        }).unref();
      }
      return { success: true };
    } catch (error: any) {
      throw new Error(`Launch fail: ${error.message}`);
    }
  });

  ipcMain.handle("spt:getStatus", async () => false);
  ipcMain.handle("dialog:selectFolder", async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory"], title: "Select SPT Folder" });
    return result.canceled || result.filePaths.length === 0 ? { canceled: true } : { canceled: false, path: result.filePaths[0] };
  });

  ipcMain.handle("dialog:selectExe", async (_event, { title, defaultPath }) => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"], title: title || "Select Exe", defaultPath, filters: [{ name: 'Exe', extensions: ['exe'] }]
    });
    return result.canceled || result.filePaths.length === 0 ? { canceled: true } : { canceled: false, path: result.filePaths[0] };
  });

  ipcMain.handle("fs:readdir", async (_event, dirPath) => {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map((e) => ({ name: e.name, isFile: e.isFile(), isDirectory: e.isDirectory() }));
  });

  ipcMain.handle("fs:readFile", async (_event, filePath) => await fs.readFile(filePath, "utf-8"));
  ipcMain.handle("fs:writeFile", async (_event, filePath, content) => {
    await fs.writeFile(filePath, content, "utf-8");
    return true;
  });

  ipcMain.handle("fs:exists", async (_event, filePath) => {
    try { await fs.access(filePath); return true; } catch { return false; }
  });

  ipcMain.handle("fs:stat", async (_event, targetPath) => {
    const stats = await fs.stat(targetPath);
    return { isDirectory: stats.isDirectory(), isFile: stats.isFile(), size: stats.size };
  });

  ipcMain.handle("fs:readCategoryFile", async () => {
    const categoryPath = path.join(app.getPath("documents"), "SPTModConfigEditor", "UserData", "categories.json");
    return fsSync.existsSync(categoryPath) ? await fs.readFile(categoryPath, "utf-8") : null;
  });

  ipcMain.handle("fs:writeCategoryFile", async (_event, content) => {
    const userDataDir = path.join(app.getPath("documents"), "SPTModConfigEditor", "UserData");
    await fs.mkdir(userDataDir, { recursive: true });
    await fs.writeFile(path.join(userDataDir, "categories.json"), content, "utf-8");
  });

  ipcMain.handle("fs:writeHistoryBackup", async (_event, modName, configFile, timestamp, content) => {
    const backupDir = path.join(app.getPath("documents"), "SPTModConfigEditor", "History Backups", modName);
    await fs.mkdir(backupDir, { recursive: true });
    const filename = `${configFile.replace(/\\|\//g, "_")}_${timestamp}.json`;
    await fs.writeFile(path.join(backupDir, filename), content, "utf-8");
    return { success: true };
  });

  ipcMain.handle("fs:readHistoryBackups", async (_event, modName, configFile) => {
    const backupDir = path.join(app.getPath("documents"), "SPTModConfigEditor", "History Backups", modName);
    if (!fsSync.existsSync(backupDir)) return [];
    const entries = await fs.readdir(backupDir);
    const prefix = configFile.replace(/\\|\//g, "_");
    const relevantEntries = entries.filter(name => name.startsWith(prefix));
    const backups = await Promise.all(relevantEntries.map(async (name) => {
      const filePath = path.join(backupDir, name);
      try {
        const [content, stats] = await Promise.all([fs.readFile(filePath, "utf-8"), fs.stat(filePath)]);
        return { filename: name, timestamp: stats.mtimeMs, content };
      } catch { return null; }
    }));
    return backups.filter(b => b !== null);
  });

  ipcMain.handle("fs:deleteHistoryBackup", async (_event, modName, filename) => {
    const backupPath = path.join(app.getPath("documents"), "SPTModConfigEditor", "History Backups", modName, filename);
    if (fsSync.existsSync(backupPath)) await fs.unlink(backupPath);
    return { success: true };
  });

  ipcMain.handle("fs:clearHistoryBackups", async (_event, modName, configFile) => {
    const backupDir = path.join(app.getPath("documents"), "SPTModConfigEditor", "History Backups", modName);
    if (!fsSync.existsSync(backupDir)) return { success: true };
    const prefix = configFile.replace(/\\|\//g, "_");
    const entries = await fs.readdir(backupDir);
    const toDelete = entries.filter(name => name.startsWith(prefix));
    await Promise.all(toDelete.map(name => fs.unlink(path.join(backupDir, name))));
    return { success: true };
  });

  ipcMain.handle("dialog:saveFile", async (_event, options) => await dialog.showSaveDialog(options));
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

// Simplified guaranteed fix for Windows shutdown
app.on("window-all-closed", () => {
  console.log("All windows closed, quitting app");
  app.quit();
});

app.on("before-quit", () => {
  console.log("App is quitting...");
});